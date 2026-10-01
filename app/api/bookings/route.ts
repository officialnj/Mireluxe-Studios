import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDayAvailability } from '@/lib/booking/availability';
import { computeTotals, type AddOnLine, type BundleLine } from '@/lib/booking/pricing';
import { BOOKING_HOLD_MINUTES } from '@/lib/booking/constants';
import { getStripe } from '@/lib/stripe';
import type { DbBundleVariant, DbServiceAddon } from '@/lib/booking/types';

const payloadSchema = z.object({
  serviceId: z.string().uuid(),
  hairIncluded: z.boolean(),
  addOnIds: z.array(z.string().uuid()).default([]),
  bundleLines: z.array(
    z.object({
      bundleVariantId: z.string().uuid(),
      quantity: z.number().int().min(1).max(20),
    })
  ),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotStart: z.string().datetime(),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(1).max(50),
  notes: z.string().trim().max(2000).nullable(),
  // Hair-prep agreement checkbox — must be checked to submit. Server-enforced
  // here (not just a disabled submit button in the UI); a request without it
  // simply fails payload validation.
  hairPrepAgreed: z.literal(true),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  const supabase = createServiceRoleClient();

  // Re-fetch the service first (availability needs its category to resolve
  // which service is being booked, but add-on validation needs the
  // service's category_id before we can call getDayAvailability with the
  // correct duration/premium-slot inputs — so fetch it directly here rather
  // than only through getDayAvailability).
  const { data: serviceRow } = await supabase.from('services').select('*').eq('id', payload.serviceId).eq('active', true).single();
  if (!serviceRow) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  }

  if (payload.hairIncluded && serviceRow.hair_incl_price_pence == null) {
    return NextResponse.json({ error: 'hair_included_unavailable' }, { status: 400 });
  }

  // Add-ons are never trusted from the client beyond their IDs — re-fetch
  // and re-validate each against the resolved service's category (or the
  // null "Hair Included Styles" bucket when hairIncluded is true), exactly
  // the same trust-nothing pattern already used for bundle variants below.
  const addOnLines: AddOnLine[] = [];
  if (payload.addOnIds.length > 0) {
    const { data: addons } = await supabase
      .from('service_addons')
      .select('*')
      .in('id', payload.addOnIds)
      .eq('active', true);
    const addonsById = new Map((addons as DbServiceAddon[] | null ?? []).map((a) => [a.id, a]));

    for (const addonId of payload.addOnIds) {
      const addon = addonsById.get(addonId);
      const belongsToResolvedBucket = addon && (payload.hairIncluded ? addon.category_id === null : addon.category_id === serviceRow.category_id);
      if (!belongsToResolvedBucket) {
        return NextResponse.json({ error: 'addon_unavailable' }, { status: 400 });
      }
      addOnLines.push({ addon: addon as DbServiceAddon });
    }
  }

  const extraDurationMins = addOnLines.reduce((sum, line) => sum + line.addon.duration_delta_mins, 0);
  const premiumSlotsUnlocked = addOnLines.some((line) => line.addon.unlocks_premium_slots);

  // Re-derive availability server-side rather than trusting the client's
  // requested slot outright — this is also what enforces hours/window/
  // blocked-date/morning-only rules and appointment_end, since the client
  // can't be trusted to compute any of that correctly.
  const { slots, service } = await getDayAvailability(
    supabase,
    payload.serviceId,
    payload.date,
    payload.hairIncluded,
    extraDurationMins,
    premiumSlotsUnlocked
  );
  if (!service) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  }

  const matchedSlot = slots.find((s) => s.start === payload.slotStart);
  if (!matchedSlot) {
    return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
  }

  const bundleLines: BundleLine[] = [];
  if (payload.bundleLines.length > 0) {
    const variantIds = payload.bundleLines.map((line) => line.bundleVariantId);
    // Effective purchasability is in_stock AND a real remaining quantity —
    // re-checked here server-side regardless of what the client claims, so
    // a direct API call can never add an out-of-stock variant to a booking.
    const { data: variants } = await supabase
      .from('bundle_variants')
      .select('*')
      .in('id', variantIds)
      .eq('in_stock', true)
      .gt('stock_quantity', 0);
    const variantsById = new Map((variants as DbBundleVariant[] | null ?? []).map((v) => [v.id, v]));

    for (const line of payload.bundleLines) {
      const variant = variantsById.get(line.bundleVariantId);
      if (!variant) {
        return NextResponse.json({ error: 'bundle_variant_unavailable' }, { status: 400 });
      }
      bundleLines.push({ variant, quantity: line.quantity });
    }
  }

  const totals = computeTotals(service, payload.hairIncluded, bundleLines, addOnLines);
  const nowIso = new Date().toISOString();

  // Opportunistic cleanup: free any stale pending_payment hold that overlaps
  // this exact request before we attempt the insert. The DB exclusion
  // constraint checks status literally, not expires_at, so a hold that's
  // logically expired but not yet flipped would otherwise block a
  // legitimate new booking for no reason. 'expired' (not 'cancelled') is the
  // correct terminal status for a lapsed hold — same status the bulk
  // app/api/cron/expire-bookings sweep now uses.
  await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .eq('status', 'pending_payment')
    .lt('expires_at', nowIso)
    .lt('appointment_start', matchedSlot.end)
    .gt('appointment_end', matchedSlot.start);

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      service_id: service.id,
      hair_included: payload.hairIncluded,
      hair_prep_agreed: payload.hairPrepAgreed,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone,
      notes: payload.notes,
      appointment_start: matchedSlot.start,
      appointment_end: matchedSlot.end,
      service_price_pence: totals.servicePricePence,
      deposit_due_pence: totals.depositDuePence,
      total_price_pence: totals.totalPricePence,
      expires_at: new Date(Date.now() + BOOKING_HOLD_MINUTES * 60_000).toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    // Postgres exclusion-constraint violation — two concurrent requests hit
    // the same slot; this is a real DB-level guarantee, not app-level
    // check-then-insert, so it's correct even across serverless instances.
    if (insertError.code === '23P01') {
      return NextResponse.json({ error: 'slot_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.depositDuePence,
      currency: 'gbp',
      metadata: { booking_id: booking.id, booking_ref: booking.booking_ref },
      receipt_email: payload.customerEmail,
    });

    await supabase.from('bookings').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', booking.id);

    if (bundleLines.length > 0) {
      await supabase.from('booking_bundles').insert(
        bundleLines.map((line) => ({
          booking_id: booking.id,
          bundle_variant_id: line.variant.id,
          quantity: line.quantity,
          price_pence_at_booking: line.variant.price_pence,
        }))
      );
    }

    if (addOnLines.length > 0) {
      await supabase.from('booking_addons').insert(
        addOnLines.map((line) => ({
          booking_id: booking.id,
          service_addon_id: line.addon.id,
          name_at_booking: line.addon.name,
          price_delta_pence_at_booking: line.addon.price_delta_pence,
          duration_delta_mins_at_booking: line.addon.duration_delta_mins,
        }))
      );
    }

    return NextResponse.json({
      bookingId: booking.id,
      bookingRef: booking.booking_ref,
      clientSecret: paymentIntent.client_secret,
      totals,
    });
  } catch {
    // Stripe setup failed (bad/placeholder key, network, etc.) — free the
    // slot immediately rather than holding it for the full 15 minutes.
    // Cascades away any booking_bundles too, but none exist yet at this
    // point since those are only inserted after Stripe succeeds.
    await supabase.from('bookings').delete().eq('id', booking.id);
    return NextResponse.json({ error: 'payment_setup_failed' }, { status: 502 });
  }
}

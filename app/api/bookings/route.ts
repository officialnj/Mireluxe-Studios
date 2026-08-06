import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDayAvailability } from '@/lib/booking/availability';
import { computeTotals, type BundleLine } from '@/lib/booking/pricing';
import { BOOKING_HOLD_MINUTES } from '@/lib/booking/constants';
import { getStripe } from '@/lib/stripe';
import type { DbBundleVariant } from '@/lib/booking/types';

const payloadSchema = z.object({
  serviceId: z.string().uuid(),
  hairIncluded: z.boolean(),
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
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  const supabase = createServiceRoleClient();

  // Re-derive availability server-side rather than trusting the client's
  // requested slot outright — this is also what enforces hours/window/
  // blocked-date/morning-only rules and appointment_end, since the client
  // can't be trusted to compute any of that correctly.
  const { slots, service } = await getDayAvailability(supabase, payload.serviceId, payload.date);
  if (!service) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  }

  if (payload.hairIncluded && service.hair_incl_price_pence == null) {
    return NextResponse.json({ error: 'hair_included_unavailable' }, { status: 400 });
  }

  const matchedSlot = slots.find((s) => s.start === payload.slotStart);
  if (!matchedSlot) {
    return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
  }

  const bundleLines: BundleLine[] = [];
  if (payload.bundleLines.length > 0) {
    const variantIds = payload.bundleLines.map((line) => line.bundleVariantId);
    const { data: variants } = await supabase.from('bundle_variants').select('*').in('id', variantIds).eq('in_stock', true);
    const variantsById = new Map((variants as DbBundleVariant[] | null ?? []).map((v) => [v.id, v]));

    for (const line of payload.bundleLines) {
      const variant = variantsById.get(line.bundleVariantId);
      if (!variant) {
        return NextResponse.json({ error: 'bundle_variant_unavailable' }, { status: 400 });
      }
      bundleLines.push({ variant, quantity: line.quantity });
    }
  }

  const totals = computeTotals(service, payload.hairIncluded, bundleLines);
  const nowIso = new Date().toISOString();

  // Opportunistic cleanup: free any stale pending_payment hold that overlaps
  // this exact request before we attempt the insert. The DB exclusion
  // constraint checks status literally, not expires_at, so a hold that's
  // logically expired but not yet flipped would otherwise block a
  // legitimate new booking for no reason.
  await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('expires_at', nowIso)
    .lt('appointment_start', matchedSlot.end)
    .gt('appointment_end', matchedSlot.start);

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      service_id: service.id,
      hair_included: payload.hairIncluded,
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

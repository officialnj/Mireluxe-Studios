import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeTotals, WITHOUT_HAIR_FLAT_DEPOSIT_PENCE } from '@/lib/booking/pricing';
import { getAdminDayAvailability } from '../_lib/adminAvailability';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatInTimeZone } from 'date-fns-tz';
import { revalidatePublicPages } from '@/lib/revalidate';
import type { DbService, DbServiceAddon } from '@/lib/booking/types';

export const dynamic = 'force-dynamic';

/**
 * Admin booking amendment. Supports changing the service (+ hair-included),
 * appointment start time, the set of add-ons, and customer notes in a single
 * request — recomputing price/deposit and re-validating availability.
 *
 * Reuses the existing availability engine (getAdminDayAvailability, excluding
 * this booking from its own conflict check) exactly like creation does: the
 * appointment is slotted by the service's own duration and the DB's
 * no_overlapping_bookings exclusion constraint is the final double-booking
 * guard (a 23P01 on update → 409 slot_taken).
 *
 * Money already collected (deposit_paid_pence) is NEVER changed here — only
 * the derived figures (service price, deposit due, total) are recomputed. No
 * charge or refund is ever initiated by an edit; if the amount due changes,
 * the UI shows the delta and the balance is settled via the Checkout tab.
 */
const bodySchema = z.object({
  serviceId: z.string().uuid().optional(),
  hairIncluded: z.boolean().optional(),
  // New appointment start (ISO). Omit to keep the current time.
  slotStart: z.string().datetime().optional(),
  // Full replacement set of add-on ids. Omit to leave add-ons unchanged;
  // pass [] to clear them.
  addonIds: z.array(z.string().uuid()).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  const supabase = createServiceRoleClient();

  // Current booking + its bundles (kept as-is) + current add-ons.
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, booking_bundles(quantity, price_pence_at_booking), booking_addons(service_addon_id)')
    .eq('id', params.id)
    .single();
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!['confirmed', 'pending_payment'].includes(booking.status)) {
    // Completed/no-show/cancelled/expired bookings are historical records —
    // don't allow silent edits to them.
    return NextResponse.json({ error: 'not_editable' }, { status: 400 });
  }

  const effectiveServiceId: string = p.serviceId ?? booking.service_id;
  const effectiveHairIncluded: boolean = p.hairIncluded ?? booking.hair_included;

  // Resolve the (possibly new) service.
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', effectiveServiceId)
    .eq('active', true)
    .single();
  if (!service) return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  const svc = service as DbService;

  if (effectiveHairIncluded && svc.hair_incl_price_pence == null) {
    return NextResponse.json({ error: 'hair_included_unavailable' }, { status: 400 });
  }

  // Resolve add-ons: new set if provided, else the booking's current set.
  const addonIds = p.addonIds ?? (booking.booking_addons ?? []).map((a: { service_addon_id: string | null }) => a.service_addon_id).filter(Boolean);
  let addonRows: DbServiceAddon[] = [];
  if (addonIds.length > 0) {
    const { data } = await supabase.from('service_addons').select('*').in('id', addonIds).eq('active', true);
    addonRows = (data as DbServiceAddon[]) ?? [];
  }
  const addOnLines = addonRows.map((addon) => ({ addon }));

  // Pricing: service + add-ons via the shared calculator; existing bundles
  // are preserved and added on top (their snapshot prices).
  const base = computeTotals(svc, effectiveHairIncluded, [], addOnLines);
  const bundlesPence = (booking.booking_bundles ?? []).reduce(
    (sum: number, b: { quantity: number; price_pence_at_booking: number }) => sum + b.price_pence_at_booking * b.quantity,
    0
  );
  const totalPricePence = base.servicePricePence + base.addOnsPricePence + bundlesPence;
  const depositDuePence = effectiveHairIncluded ? Math.round(totalPricePence * 0.5) : WITHOUT_HAIR_FLAT_DEPOSIT_PENCE;

  // Decide whether the time slot must be re-validated: only when something
  // that affects the slot changes (start time, service, or hair-included,
  // since those change the duration/candidate grid). Pure notes/add-on edits
  // keep the existing time untouched.
  const timeChanged = Boolean(p.slotStart) && p.slotStart !== booking.appointment_start;
  const serviceOrHairChanged = effectiveServiceId !== booking.service_id || effectiveHairIncluded !== booking.hair_included;
  const mustReslot = timeChanged || serviceOrHairChanged;

  let appointmentStart = booking.appointment_start as string;
  let appointmentEnd = booking.appointment_end as string;

  if (mustReslot) {
    const targetStartIso = p.slotStart ?? booking.appointment_start;
    const dateStr = formatInTimeZone(new Date(targetStartIso), STUDIO_TIMEZONE, 'yyyy-MM-dd');
    const { slots } = await getAdminDayAvailability(supabase, svc.id, dateStr, effectiveHairIncluded, booking.id);
    const matched = slots.find((s) => s.start === targetStartIso);
    if (!matched) {
      // Can't place the appointment there — hand back the day's valid starts
      // so the UI can offer alternatives.
      return NextResponse.json({ error: 'slot_unavailable', slots }, { status: 409 });
    }
    appointmentStart = matched.start;
    appointmentEnd = matched.end;
  }

  // Update the booking core. deposit_paid_pence is deliberately untouched.
  const update: Record<string, unknown> = {
    service_id: svc.id,
    hair_included: effectiveHairIncluded,
    appointment_start: appointmentStart,
    appointment_end: appointmentEnd,
    service_price_pence: base.servicePricePence,
    deposit_due_pence: depositDuePence,
    total_price_pence: totalPricePence,
  };
  if (p.notes !== undefined) update.notes = p.notes;

  const { error: updateError } = await supabase.from('bookings').update(update).eq('id', booking.id);
  if (updateError) {
    if (updateError.code === '23P01') return NextResponse.json({ error: 'slot_taken' }, { status: 409 });
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  // Replace the add-on snapshot rows only when a new set was explicitly given.
  if (p.addonIds !== undefined) {
    await supabase.from('booking_addons').delete().eq('booking_id', booking.id);
    if (addonRows.length > 0) {
      await supabase.from('booking_addons').insert(
        addonRows.map((a) => ({
          booking_id: booking.id,
          service_addon_id: a.id,
          name_at_booking: a.name,
          price_delta_pence_at_booking: a.price_delta_pence,
          duration_delta_mins_at_booking: a.duration_delta_mins,
        }))
      );
    }
  }

  revalidatePublicPages();

  const { data: updated } = await supabase
    .from('bookings')
    .select(
      '*, services(name, service_time_mins), booking_bundles(quantity, price_pence_at_booking, bundle_variants(inches, colour)), booking_addons(name_at_booking, price_delta_pence_at_booking, duration_delta_mins_at_booking)'
    )
    .eq('id', booking.id)
    .single();

  return NextResponse.json({
    booking: updated,
    pricing: {
      previousTotalPence: booking.total_price_pence,
      newTotalPence: totalPricePence,
      differencePence: totalPricePence - booking.total_price_pence,
      depositPaidPence: booking.deposit_paid_pence,
      balanceDuePence: Math.max(0, totalPricePence - booking.deposit_paid_pence),
    },
  });
}

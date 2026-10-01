import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeTotals } from '@/lib/booking/pricing';
import { getAdminDayAvailability } from './_lib/adminAvailability';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const date = request.nextUrl.searchParams.get('date'); // optional YYYY-MM-DD filter
  // Optional YYYY-MM-DD range filter, additive to `date` — used by the admin
  // bookings calendar (week/month views) to fetch a whole visible range in
  // one request instead of one call per day.
  const from = request.nextUrl.searchParams.get('from');
  const through = request.nextUrl.searchParams.get('through');
  const supabase = createServiceRoleClient();
  let query = supabase
    .from('bookings')
    .select('*, services(name, service_time_mins)')
    .in('status', ['pending_payment', 'confirmed', 'completed', 'no_show'])
    .order('appointment_start', { ascending: true });

  if (date) {
    query = query.gte('appointment_start', `${date}T00:00:00Z`).lt('appointment_start', `${date}T23:59:59Z`);
  } else if (from || through) {
    if (from) query = query.gte('appointment_start', `${from}T00:00:00Z`);
    if (through) query = query.lt('appointment_start', `${through}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}

const createSchema = z.object({
  serviceId: z.string().uuid(),
  hairIncluded: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotStart: z.string().datetime(),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(1).max(50),
  notes: z.string().trim().max(2000).nullable().optional(),
  // Admin is physically present (or on the phone) and can verbally confirm
  // the hair-prep agreement — defaults true, unlike the customer flow's
  // z.literal(true), but still an explicit checkbox in CreateBookingModal.
  hairPrepAgreed: z.boolean().optional().default(true),
  paymentMethod: z.enum(['cash', 'other']).optional().default('cash'),
  // Manually reconciled money — trust the admin's entry of what was actually
  // collected rather than forcing it to equal the computed deposit.
  depositPaidPence: z.number().int().min(0),
});

/**
 * Manually create a walk-in/phone booking. Skips Stripe entirely: inserted
 * straight to status='confirmed', created_by_admin=true. The DB's
 * no_overlapping_bookings exclusion constraint is still the final word on
 * double-booking — the slot is re-validated server-side against
 * getAdminDayAvailability first (which also derives appointment_end), but a
 * 23P01 from the insert itself is what actually prevents a race.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  const payload = parsed.data;

  const supabase = createServiceRoleClient();

  const { slots, service } = await getAdminDayAvailability(supabase, payload.serviceId, payload.date, payload.hairIncluded);
  if (!service) return NextResponse.json({ error: 'service_not_found' }, { status: 404 });

  if (payload.hairIncluded && service.hair_incl_price_pence == null) {
    return NextResponse.json({ error: 'hair_included_unavailable' }, { status: 400 });
  }

  const matchedSlot = slots.find((s) => s.start === payload.slotStart);
  if (!matchedSlot) return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });

  const totals = computeTotals(service, payload.hairIncluded, []);

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      service_id: service.id,
      hair_included: payload.hairIncluded,
      hair_prep_agreed: payload.hairPrepAgreed,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone,
      notes: payload.notes ?? null,
      appointment_start: matchedSlot.start,
      appointment_end: matchedSlot.end,
      status: 'confirmed',
      service_price_pence: totals.servicePricePence,
      deposit_due_pence: totals.depositDuePence,
      deposit_paid_pence: payload.depositPaidPence,
      total_price_pence: totals.totalPricePence,
      created_by_admin: true,
      payment_method: payload.paymentMethod,
    })
    .select('*, services(name, service_time_mins)')
    .single();

  if (insertError) {
    if (insertError.code === '23P01') return NextResponse.json({ error: 'slot_taken' }, { status: 409 });
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 });
  }

  revalidatePublicPages();
  return NextResponse.json({ booking });
}

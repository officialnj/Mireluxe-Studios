import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { differenceInMinutes } from 'date-fns';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDayAvailability } from '@/lib/booking/availability';
import { SELF_SERVICE_CUTOFF_MINUTES } from '@/lib/booking/constants';
import { getResend, logEmailResult } from '@/lib/resend';
import { rescheduleConfirmationEmail } from '@/lib/email/templates';
import { revalidatePublicPages } from '@/lib/revalidate';
import type { DbService } from '@/lib/booking/types';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotStart: z.string().datetime(),
});

// Same unauthenticated capability-token pattern as GET /api/bookings/[id]/status
// — the booking id itself is the secret. Only ever mutates this one row's
// schedule (appointment_start/end); never price, status, or another booking.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsedBody.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', parsedParams.data.id).single();
  if (error || !booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'not_reschedulable' }, { status: 409 });
  }

  // No self-service reschedule within 48 hours of the CURRENT appointment
  // start — server-enforced, independent of anything the client sends.
  const minutesUntilAppointment = differenceInMinutes(new Date(booking.appointment_start), new Date());
  if (minutesUntilAppointment < SELF_SERVICE_CUTOFF_MINUTES) {
    return NextResponse.json({ error: 'past_cutoff' }, { status: 409 });
  }

  // Re-derive the new slot server-side exactly like booking creation does —
  // never trust the client's requested start/end. This also enforces the
  // release window, the 2-hour minimum notice, and all blocking rules.
  const { slots, service } = await getDayAvailability(supabase, booking.service_id, parsedBody.data.date);
  if (!service) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 });
  }

  const matchedSlot = slots.find((s) => s.start === parsedBody.data.slotStart);
  if (!matchedSlot) {
    return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ appointment_start: matchedSlot.start, appointment_end: matchedSlot.end })
    .eq('id', booking.id)
    .eq('status', 'confirmed');

  if (updateError) {
    // Postgres exclusion-constraint violation — the DB is still the final
    // word on double-booking, same guarantee as booking creation.
    if (updateError.code === '23P01') {
      return NextResponse.json({ error: 'slot_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'reschedule_failed' }, { status: 500 });
  }

  await sendRescheduleEmail(supabase, {
    ...booking,
    appointment_start: matchedSlot.start,
    appointment_end: matchedSlot.end,
  }, { start: booking.appointment_start, end: booking.appointment_end }, { start: matchedSlot.start, end: matchedSlot.end });

  revalidatePublicPages();
  return NextResponse.json({ ok: true, appointmentStart: matchedSlot.start, appointmentEnd: matchedSlot.end });
}

async function sendRescheduleEmail(
  supabase: ReturnType<typeof createServiceRoleClient>,
  booking: Parameters<typeof rescheduleConfirmationEmail>[0],
  oldSlot: { start: string; end: string },
  newSlot: { start: string; end: string }
) {
  try {
    const { data: service } = await supabase.from('services').select('*').eq('id', booking.service_id).single();
    if (!service) return;
    const resend = getResend();
    const email = rescheduleConfirmationEmail(booking, service as DbService, oldSlot, newSlot);
    const result = await resend.emails.send({
      from: 'MIRILUXE Studios <bookings@miriluxe.co.uk>',
      to: booking.customer_email,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
    });
    logEmailResult(`reschedule confirmation for booking ${booking.id}`, result);
  } catch {
    // Best-effort — the reschedule itself already succeeded in the DB
    // regardless of email delivery.
  }
}

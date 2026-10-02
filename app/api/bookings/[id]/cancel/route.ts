import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { differenceInMinutes } from 'date-fns';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { SELF_SERVICE_CUTOFF_MINUTES } from '@/lib/booking/constants';
import { getResend, logEmailResult } from '@/lib/resend';
import { cancellationConfirmationEmail } from '@/lib/email/templates';
import { revalidatePublicPages } from '@/lib/revalidate';
import type { DbBooking, DbService } from '@/lib/booking/types';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

// Same unauthenticated capability-token pattern as GET /api/bookings/[id]/status
// — the booking id itself is the secret. Customer-initiated, so the
// resulting status is 'cancelled' (distinct from the system-driven
// 'expired' a lapsed hold gets).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', parsed.data.id).single();
  if (error || !booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'not_cancellable' }, { status: 409 });
  }

  // No self-service cancel within 48 hours of the appointment start —
  // server-enforced.
  const minutesUntilAppointment = differenceInMinutes(new Date(booking.appointment_start), new Date());
  if (minutesUntilAppointment < SELF_SERVICE_CUTOFF_MINUTES) {
    return NextResponse.json({ error: 'past_cutoff' }, { status: 409 });
  }

  // Outside the 48-hour cutoff is exactly the case the studio's stated
  // cancellation policy treats as deposit-refundable (see
  // CANCELLATION_POLICY_PLACEHOLDER), so refund automatically — same Stripe
  // call the admin cancel route makes.
  if (booking.stripe_payment_intent_id) {
    try {
      await getStripe().refunds.create({ payment_intent: booking.stripe_payment_intent_id });
    } catch {
      return NextResponse.json({ error: 'refund_failed' }, { status: 502 });
    }
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .eq('status', 'confirmed');

  if (updateError) {
    return NextResponse.json({ error: 'cancel_failed' }, { status: 500 });
  }

  await sendCancellationEmail(supabase, booking as DbBooking);

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

async function sendCancellationEmail(supabase: ReturnType<typeof createServiceRoleClient>, booking: DbBooking) {
  try {
    const { data: service } = await supabase.from('services').select('*').eq('id', booking.service_id).single();
    if (!service) return;
    const resend = getResend();
    const email = cancellationConfirmationEmail(booking, service as DbService);
    const result = await resend.emails.send({
      from: 'MIRILUXE Studios <bookings@miriluxe.co.uk>',
      to: booking.customer_email,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
    });
    logEmailResult(`cancellation confirmation for booking ${booking.id}`, result);
  } catch {
    // Best-effort — the cancellation itself already succeeded in the DB
    // (and the refund, if applicable) regardless of email delivery.
  }
}

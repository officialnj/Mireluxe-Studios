import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getResend } from '@/lib/resend';
import { customerConfirmationEmail, ownerNotificationEmail } from '@/lib/email/templates';
import type { DbBooking, DbService } from '@/lib/booking/types';

export const runtime = 'nodejs';

// The webhook is the sole source of truth for confirming a booking — the
// frontend success screen is purely presentational and never itself flips
// booking status. Never trust the client alone to mark a booking as paid.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const supabase = createServiceRoleClient();

    const { data: booking } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', deposit_paid_pence: intent.amount_received })
      .eq('stripe_payment_intent_id', intent.id)
      .eq('status', 'pending_payment')
      .select()
      .single();

    if (booking) {
      await sendConfirmationEmails(supabase, booking as DbBooking);
    }
  }

  // payment_intent.payment_failed is intentionally a no-op: the booking
  // stays 'pending_payment' so the customer can retry with a different card
  // against the same PaymentIntent/client_secret. It only ever gets
  // released by the 15-minute expiry (lazy-filtered in availability + the
  // cron sweep), never immediately on a single failed attempt.

  return NextResponse.json({ received: true });
}

async function sendConfirmationEmails(
  supabase: ReturnType<typeof createServiceRoleClient>,
  booking: DbBooking
) {
  const { data: service } = await supabase.from('services').select('*').eq('id', booking.service_id).single();
  if (!service) return;

  try {
    const resend = getResend();
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const customerEmail = customerConfirmationEmail(booking, service as DbService);
    const ownerEmail = ownerNotificationEmail(booking, service as DbService);

    await Promise.allSettled([
      resend.emails.send({
        from: 'MIRILUXE Studios <bookings@mireluxestudios.co.uk>',
        to: booking.customer_email,
        subject: customerEmail.subject,
        html: customerEmail.html,
      }),
      adminEmail
        ? resend.emails.send({
            from: 'MIRILUXE Studios <bookings@mireluxestudios.co.uk>',
            to: adminEmail,
            subject: ownerEmail.subject,
            html: ownerEmail.html,
          })
        : Promise.resolve(null),
    ]);
  } catch {
    // Resend not configured yet (placeholder key) — booking is already
    // confirmed in the DB regardless, email is a best-effort side effect.
  }
}

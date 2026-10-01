import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getResend } from '@/lib/resend';
import {
  ownerNotificationEmail,
  shopOrderConfirmationEmail,
  type AddOnLineInfo,
  type BundleLineInfo,
  type ShopOrder,
} from '@/lib/email/templates';
import type { DbBooking, DbService } from '@/lib/booking/types';
import type { DbShopOrder } from '@/lib/shop/types';
import { incrementDiscountUsage } from '@/lib/shop/discounts';
import { sendBookingConfirmation } from '@/lib/reminders/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Supabase = ReturnType<typeof createServiceRoleClient>;

const FROM_ADDRESS = 'MIRILUXE Studios <bookings@miriluxe.co.uk>';

// Postgres exclusion-constraint violation (no_overlapping_bookings).
const SLOT_CONFLICT_CODE = '23P01';

// Thrown for transient failures (DB/network). Returning a 500 makes Stripe
// retry the event with backoff for up to 3 days, instead of dropping it.
class RetryableError extends Error {}

// The webhook is the sole source of truth for confirming a booking — the
// frontend success screen is purely presentational and never itself flips
// booking status. Never trust the client alone to mark a booking as paid.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    // The frontend only ever uses Stripe Elements against a PaymentIntent
    // directly today (see components/booking/PaymentStep.tsx), so
    // payment_intent.succeeded is the event that actually fires in practice.
    // checkout.session.completed is handled defensively alongside it — same
    // confirmation logic, keyed off the PaymentIntent id the session carries —
    // in case a Checkout Session flow is ever introduced.
    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
      if (paymentIntentId) {
        const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
        await handlePaymentSucceeded(intent);
      }
    }
    // payment_intent.payment_failed is intentionally a no-op: the booking
    // stays 'pending_payment' so the customer can retry with a different card
    // against the same PaymentIntent/client_secret. It only ever gets
    // released by the 15-minute expiry (lazy-filtered in availability + the
    // cron sweep), never immediately on a single failed attempt.
  } catch (err) {
    console.error(`[stripe-webhook] failed handling ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const supabase = createServiceRoleClient();
  const bookingId = intent.metadata?.booking_id;
  const shopOrderId = intent.metadata?.shop_order_id;

  // Look up by the id stored in the PaymentIntent metadata first. The
  // stripe_payment_intent_id column is written in a second, unchecked query
  // after the intent is created, so it can be missing; metadata cannot.
  if (bookingId) {
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (error) throw new RetryableError(`booking lookup failed: ${error.message}`);
    if (data) return confirmBooking(supabase, intent, data as DbBooking);
  }

  if (shopOrderId) {
    const { data, error } = await supabase.from('shop_orders').select('*').eq('id', shopOrderId).maybeSingle();
    if (error) throw new RetryableError(`shop order lookup failed: ${error.message}`);
    if (data) return markShopOrderPaid(supabase, intent, data as ShopOrder & DbShopOrder);
  }

  // Fallback for intents without metadata: match on the stored intent id.
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('stripe_payment_intent_id', intent.id)
    .maybeSingle();
  if (bookingError) throw new RetryableError(`booking lookup failed: ${bookingError.message}`);
  if (booking) return confirmBooking(supabase, intent, booking as DbBooking);

  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('stripe_payment_intent_id', intent.id)
    .maybeSingle();
  if (orderError) throw new RetryableError(`shop order lookup failed: ${orderError.message}`);
  if (order) return markShopOrderPaid(supabase, intent, order as ShopOrder & DbShopOrder);

  console.warn(`[stripe-webhook] no booking or shop order matches PaymentIntent ${intent.id}`);
}

async function confirmBooking(supabase: Supabase, intent: Stripe.PaymentIntent, booking: DbBooking) {
  const { status } = booking;

  // Already handled (Stripe can deliver the same event more than once).
  if (status === 'confirmed' || status === 'completed') return;

  const paidFields = {
    status: 'confirmed',
    deposit_paid_pence: intent.amount_received,
    stripe_payment_intent_id: intent.id,
  };

  if (status === 'pending_payment') {
    const { data, error } = await supabase
      .from('bookings')
      .update(paidFields)
      .eq('id', booking.id)
      .eq('status', 'pending_payment')
      .select()
      .maybeSingle();
    if (error) throw new RetryableError(`booking confirm failed: ${error.message}`);
    if (data) await sendConfirmationEmails(supabase, data as DbBooking);
    return;
  }

  // status === 'cancelled' or 'expired': the customer paid after their
  // 15-minute hold lapsed (swept by the cron job or opportunistically by a
  // later booking attempt) or was explicitly cancelled. The money has been
  // taken, so either reinstate the booking (slot still free) or refund it
  // (slot now taken). Previously only 'cancelled' was handled here, so a
  // late payment against an 'expired' hold fell through both branches
  // below and was silently dropped: no booking, no refund, no email.
  const { data: reinstated, error: reinstateError } = await supabase
    .from('bookings')
    .update(paidFields)
    .eq('id', booking.id)
    .in('status', ['cancelled', 'expired'])
    .select()
    .maybeSingle();

  if (!reinstateError) {
    if (reinstated) await sendConfirmationEmails(supabase, reinstated as DbBooking);
    return;
  }

  if (reinstateError.code !== SLOT_CONFLICT_CODE) {
    throw new RetryableError(`booking reinstate failed: ${reinstateError.message}`);
  }

  // Slot was taken by someone else in the meantime. Refund in full. The
  // idempotency key stops a retried event from refunding twice.
  await getStripe().refunds.create(
    { payment_intent: intent.id, metadata: { reason: 'slot_no_longer_available', booking_id: booking.id } },
    { idempotencyKey: `late-payment-refund-${intent.id}` }
  );
  await sendLatePaymentRefundEmails(booking, intent.amount_received);
}

async function markShopOrderPaid(supabase: Supabase, intent: Stripe.PaymentIntent, order: ShopOrder & DbShopOrder) {
  if (order.status !== 'pending_payment') return;

  const { data, error } = await supabase
    .from('shop_orders')
    .update({ status: 'paid', stripe_payment_intent_id: intent.id })
    .eq('id', order.id)
    .eq('status', 'pending_payment')
    .select()
    .maybeSingle();
  if (error) throw new RetryableError(`shop order update failed: ${error.message}`);
  if (!data) return;

  const paidOrder = data as ShopOrder & DbShopOrder;
  await decrementBundleStock(supabase, paidOrder);
  await sendShopOrderConfirmationEmail(paidOrder);
  // Only counted once payment is actually confirmed — a created-but-
  // abandoned PaymentIntent must never consume a limited-use code.
  if (paidOrder.discount_code_id) {
    await incrementDiscountUsage(supabase, paidOrder.discount_code_id);
  }
}

async function sendConfirmationEmails(supabase: Supabase, booking: DbBooking) {
  const { data: service } = await supabase.from('services').select('*').eq('id', booking.service_id).single();
  if (!service) return;

  const { data: bookingBundles } = await supabase
    .from('booking_bundles')
    .select('quantity, price_pence_at_booking, bundle_variants(inches, colour)')
    .eq('booking_id', booking.id);

  const bundleLines: BundleLineInfo[] = (bookingBundles ?? [])
    .filter((line) => line.bundle_variants)
    .map((line) => ({
      inches: (line.bundle_variants as unknown as { inches: number; colour: string }).inches,
      colour: (line.bundle_variants as unknown as { inches: number; colour: string }).colour,
      quantity: line.quantity,
      pricePence: line.price_pence_at_booking,
    }));

  const { data: bookingAddons } = await supabase
    .from('booking_addons')
    .select('name_at_booking, price_delta_pence_at_booking')
    .eq('booking_id', booking.id);

  const addOnLines: AddOnLineInfo[] = (bookingAddons ?? []).map((line) => ({
    name: line.name_at_booking,
    priceDeltaPence: line.price_delta_pence_at_booking,
  }));

  try {
    const resend = getResend();
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const ownerEmail = ownerNotificationEmail(booking, service as DbService, bundleLines, addOnLines);

    await Promise.allSettled([
      sendBookingConfirmation(booking.id),
      adminEmail
        ? resend.emails.send({
            from: FROM_ADDRESS,
            to: adminEmail,
            replyTo: ownerEmail.replyTo,
            subject: ownerEmail.subject,
            html: ownerEmail.html,
          })
        : Promise.resolve(null),
    ]);
  } catch (err) {
    // Resend not configured yet — booking is already confirmed in the DB
    // regardless, email is a best-effort side effect.
    console.error('[stripe-webhook] confirmation email failed', err);
  }
}

async function sendLatePaymentRefundEmails(booking: DbBooking, amountPence: number) {
  const amount = `£${(amountPence / 100).toFixed(2)}`;
  const ref = booking.booking_ref;

  try {
    const resend = getResend();
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    await Promise.allSettled([
      resend.emails.send({
        from: FROM_ADDRESS,
        to: booking.customer_email,
        subject: `Your deposit has been refunded (${ref})`,
        html:
          `<p>Hi ${escapeHtml(booking.customer_name)},</p>` +
          `<p>Your payment came through after your 15-minute booking hold expired, and the time slot has since been taken. ` +
          `We have refunded your ${amount} deposit in full. It should reach your account within 5 to 10 working days.</p>` +
          `<p>Please book another time on our website, or reply to this email and we will help.</p>`,
      }),
      adminEmail
        ? resend.emails.send({
            from: FROM_ADDRESS,
            to: adminEmail,
            subject: `Late payment auto-refunded (${ref})`,
            html:
              `<p>A deposit of ${amount} from ${escapeHtml(booking.customer_name)} (${escapeHtml(booking.customer_email)}) ` +
              `arrived after the booking hold expired and the slot was already taken. It has been refunded automatically.</p>`,
          })
        : Promise.resolve(null),
    ]);
  } catch (err) {
    console.error('[stripe-webhook] refund email failed', err);
  }
}

async function sendShopOrderConfirmationEmail(order: ShopOrder) {
  try {
    const resend = getResend();
    const email = shopOrderConfirmationEmail(order);
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: order.customer_email,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
    });
  } catch (err) {
    // Same best-effort semantics as sendConfirmationEmails — the order is
    // already marked paid in the DB regardless of email delivery.
    console.error('[stripe-webhook] shop order email failed', err);
  }
}

// Stock was already validated as available at checkout time
// (app/api/shop/checkout/route.ts), but only decremented here, once payment
// is actually confirmed by the webhook — never on checkout creation, so an
// abandoned/failed PaymentIntent never depletes stock.
async function decrementBundleStock(supabase: Supabase, order: ShopOrder) {
  for (const item of order.items) {
    const { data: variant } = await supabase
      .from('bundle_variants')
      .select('stock_quantity')
      .eq('id', item.slug)
      .single();
    if (!variant) continue;
    const nextQuantity = Math.max(0, variant.stock_quantity - item.quantity);
    await supabase.from('bundle_variants').update({ stock_quantity: nextQuantity }).eq('id', item.slug);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

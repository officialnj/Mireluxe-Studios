import { createServiceRoleClient } from '@/lib/supabase/server';
import { getResend, logEmailResult } from '@/lib/resend';
import { customerConfirmationEmail, ownerNotificationEmail, type AddOnLineInfo, type BundleLineInfo } from '@/lib/email/templates';
import type { DbBooking, DbService } from '@/lib/booking/types';

export const CONFIRMATION_FROM_ADDRESS = 'MIRILUXE Studios <bookings@miriluxe.co.uk>';

type Supabase = ReturnType<typeof createServiceRoleClient>;

// Shared by the Stripe webhook (automatic, on payment success) and the admin
// resend-confirmation route (manual, e.g. a customer reports never receiving
// theirs). Never throws — email is a best-effort side effect, the booking's
// own status is the source of truth regardless of delivery outcome.
export async function sendConfirmationEmails(supabase: Supabase, booking: DbBooking) {
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
    const customerEmail = customerConfirmationEmail(booking, service as DbService, bundleLines, addOnLines);
    const ownerEmail = ownerNotificationEmail(booking, service as DbService, bundleLines, addOnLines);

    const [customerResult, ownerResult] = await Promise.allSettled([
      resend.emails.send({
        from: CONFIRMATION_FROM_ADDRESS,
        to: booking.customer_email,
        replyTo: customerEmail.replyTo,
        subject: customerEmail.subject,
        html: customerEmail.html,
        attachments: customerEmail.attachments,
      }),
      adminEmail
        ? resend.emails.send({
            from: CONFIRMATION_FROM_ADDRESS,
            to: adminEmail,
            replyTo: ownerEmail.replyTo,
            subject: ownerEmail.subject,
            html: ownerEmail.html,
          })
        : Promise.resolve(null),
    ]);
    if (customerResult.status === 'fulfilled' && customerResult.value) {
      logEmailResult(`confirmation to customer for booking ${booking.id}`, customerResult.value);
    }
    if (ownerResult.status === 'fulfilled' && ownerResult.value) {
      logEmailResult(`owner notification for booking ${booking.id}`, ownerResult.value);
    }
  } catch (err) {
    console.error('[sendConfirmationEmails] failed', err);
  }
}

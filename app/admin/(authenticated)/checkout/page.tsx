import { createServiceRoleClient } from '@/lib/supabase/server';
import CheckoutCenter, { type CheckoutItem } from '@/components/admin/CheckoutCenter';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  booking_ref: string;
  customer_name: string;
  appointment_start: string;
  total_price_pence: number;
  deposit_paid_pence: number;
  balance_collected_at: string | null;
  balance_payment_method: string | null;
  services: { name: string } | null;
  booking_addons: { name_at_booking: string; price_delta_pence_at_booking: number }[] | null;
  booking_bundles:
    | { quantity: number; price_pence_at_booking: number; bundle_variants: { inches: number; colour: string } | null }[]
    | null;
};

/** Acuity-style "Checkout Center": upcoming confirmed appointments with the
 *  remaining balance (total − deposit already paid) owing in-studio. */
export default async function AdminCheckoutPage() {
  const supabase = createServiceRoleClient();

  // Confirmed appointments from (roughly) today onwards. We filter by status
  // and order by date; balance is derived per row below.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('bookings')
    .select(
      'id, booking_ref, customer_name, appointment_start, total_price_pence, deposit_paid_pence, balance_collected_at, balance_payment_method, services(name), booking_addons(name_at_booking, price_delta_pence_at_booking), booking_bundles(quantity, price_pence_at_booking, bundle_variants(inches, colour))'
    )
    .eq('status', 'confirmed')
    .gte('appointment_start', todayStart.toISOString())
    .order('appointment_start', { ascending: true });

  const items: CheckoutItem[] = ((data as Row[] | null) ?? [])
    .map((b) => {
      const balance = Math.max(0, b.total_price_pence - b.deposit_paid_pence);
      return {
        id: b.id,
        booking_ref: b.booking_ref,
        customer_name: b.customer_name,
        service_name: b.services?.name ?? 'Appointment',
        appointment_start: b.appointment_start,
        total_price_pence: b.total_price_pence,
        deposit_paid_pence: b.deposit_paid_pence,
        balance_pence: balance,
        balance_collected_at: b.balance_collected_at,
        balance_payment_method: b.balance_payment_method,
        addons: (b.booking_addons ?? []).map((a) => ({
          name: a.name_at_booking,
          price_pence: a.price_delta_pence_at_booking,
        })),
        bundles: (b.booking_bundles ?? []).map((bb) => ({
          label: bb.bundle_variants ? `${bb.bundle_variants.inches}" ${bb.bundle_variants.colour}` : 'Bundle',
          quantity: bb.quantity,
          price_pence: bb.price_pence_at_booking,
        })),
      };
    })
    // Keep appointments that either still owe a balance or were settled here
    // (so Mirakle can see / undo recent collections). Zero-balance, never-owed
    // appointments are dropped to keep the list focused.
    .filter((i) => i.balance_pence > 0 || i.balance_collected_at);

  return (
    <div>
      <h1 className="mb-1 font-serif text-2xl font-light">Checkout</h1>
      <p className="mb-6 text-sm text-charcoal/55">
        Remaining balances for upcoming appointments. Deposits are taken online at booking; collect the rest in the studio.
      </p>
      <CheckoutCenter initialItems={items} />
    </div>
  );
}

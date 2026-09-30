import { createServiceRoleClient } from '@/lib/supabase/server';
import CustomerDirectory, { type CustomerBookingRow, type CustomerOrderRow, type CustomerRecord } from '@/components/admin/CustomerDirectory';
import type { DbBooking, BookingStatus } from '@/lib/booking/types';
import type { DbShopOrder } from '@/lib/shop/types';

export const dynamic = 'force-dynamic';

type BookingWithService = DbBooking & { services: { name: string } | null };

// Money actually collected, not merely owed/pending.
const SPEND_COUNTING_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'completed'];

export default async function AdminCustomersPage() {
  const supabase = createServiceRoleClient();

  const [{ data: bookingsData }, { data: ordersData }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, services(name)')
      .order('created_at', { ascending: false }),
    supabase.from('shop_orders').select('*').order('created_at', { ascending: false }),
  ]);

  const bookings = (bookingsData ?? []) as BookingWithService[];
  const orders = (ordersData ?? []) as DbShopOrder[];

  const customersByEmail = new Map<string, CustomerRecord>();

  function touchCustomer(email: string, name: string, phone: string | null, activityAt: string) {
    const key = email.toLowerCase().trim();
    const existing = customersByEmail.get(key);
    if (!existing) {
      customersByEmail.set(key, {
        email: key,
        name,
        phone: phone ?? null,
        nameVariants: [name],
        phoneVariants: phone ? [phone] : [],
        bookingsCount: 0,
        ordersCount: 0,
        lifetimeSpendPence: 0,
        lastActivityAt: activityAt,
      });
      return;
    }
    // Most-recent record wins for "current" contact info (records are
    // processed in descending created_at order already).
    if (activityAt > existing.lastActivityAt) {
      existing.lastActivityAt = activityAt;
    }
    if (!existing.nameVariants.includes(name)) existing.nameVariants.push(name);
    if (phone && !existing.phoneVariants.includes(phone)) existing.phoneVariants.push(phone);
  }

  // Process in ascending order for name/phone "most recent" purposes by
  // reversing, since arrays were fetched newest-first.
  const bookingsAscending = [...bookings].reverse();
  const ordersAscending = [...orders].reverse();

  for (const booking of bookingsAscending) {
    touchCustomer(booking.customer_email, booking.customer_name, booking.customer_phone, booking.created_at);
    const record = customersByEmail.get(booking.customer_email.toLowerCase().trim())!;
    record.bookingsCount += 1;
    record.name = booking.customer_name;
    record.phone = booking.customer_phone;
    if (SPEND_COUNTING_BOOKING_STATUSES.includes(booking.status)) {
      record.lifetimeSpendPence += booking.deposit_paid_pence || 0;
    }
  }

  for (const order of ordersAscending) {
    touchCustomer(order.customer_email, order.customer_name, order.customer_phone, order.created_at);
    const record = customersByEmail.get(order.customer_email.toLowerCase().trim())!;
    record.ordersCount += 1;
    record.name = order.customer_name;
    record.phone = order.customer_phone;
    if (order.status === 'paid') {
      record.lifetimeSpendPence += order.subtotal_pence || 0;
    }
  }

  const customers = Array.from(customersByEmail.values()).sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );

  const bookingRows: CustomerBookingRow[] = bookings.map((b) => ({
    id: b.id,
    email: b.customer_email.toLowerCase().trim(),
    serviceName: b.services?.name ?? '—',
    appointmentStart: b.appointment_start,
    status: b.status,
    amountPence: b.deposit_paid_pence || b.deposit_due_pence,
  }));

  const orderRows: CustomerOrderRow[] = orders.map((o) => ({
    id: o.id,
    email: o.customer_email.toLowerCase().trim(),
    items: o.items,
    createdAt: o.created_at,
    status: o.status,
    subtotalPence: o.subtotal_pence,
  }));

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Customers</h1>
      <CustomerDirectory customers={customers} bookings={bookingRows} orders={orderRows} />
    </div>
  );
}

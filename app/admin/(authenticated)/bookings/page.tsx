import { createServiceRoleClient } from '@/lib/supabase/server';
import BookingsViewTabs from '@/components/admin/BookingsViewTabs';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const supabase = createServiceRoleClient();
  // Includes completed/no_show (in addition to the live pending_payment/
  // confirmed statuses) so bookings the admin just marked via the new
  // status-transition actions don't simply vanish from the list/calendar.
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      '*, services(name, service_time_mins), booking_bundles(quantity, price_pence_at_booking, bundle_variants(inches, colour)), booking_addons(name_at_booking, price_delta_pence_at_booking, duration_delta_mins_at_booking)'
    )
    .in('status', ['pending_payment', 'confirmed', 'completed', 'no_show'])
    .order('appointment_start', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Calendar</h1>
      {/* CreateBookingModal lives inside the calendar top bar (and the list
          view) rather than the page header, so it sits where the action is
          contextually expected in each view. */}
      <BookingsViewTabs initialBookings={bookings ?? []} />
    </div>
  );
}

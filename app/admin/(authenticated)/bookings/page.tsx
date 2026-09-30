import { createServiceRoleClient } from '@/lib/supabase/server';
import BookingsViewTabs from '@/components/admin/BookingsViewTabs';
import CreateBookingModal from '@/components/admin/CreateBookingModal';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const supabase = createServiceRoleClient();
  // Includes completed/no_show (in addition to the live pending_payment/
  // confirmed statuses) so bookings the admin just marked via the new
  // status-transition actions don't simply vanish from the list/calendar.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, service_time_mins)')
    .in('status', ['pending_payment', 'confirmed', 'completed', 'no_show'])
    .order('appointment_start', { ascending: true });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-light">Bookings</h1>
        {/* Sits above the list/calendar tab switcher (owned by
            BookingsViewTabs, out of scope here) so it's reachable from
            either view rather than needing to be duplicated per-view. */}
        <CreateBookingModal />
      </div>
      <BookingsViewTabs initialBookings={bookings ?? []} />
    </div>
  );
}

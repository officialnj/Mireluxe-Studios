import { createServiceRoleClient } from '@/lib/supabase/server';
import BookingsTable from '@/components/admin/BookingsTable';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const supabase = createServiceRoleClient();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, service_time_mins)')
    .in('status', ['pending_payment', 'confirmed'])
    .order('appointment_start', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Bookings</h1>
      <BookingsTable initialBookings={bookings ?? []} />
    </div>
  );
}

import { format } from 'date-fns';
import { createServiceRoleClient } from '@/lib/supabase/server';
import AvailabilityCalendar from '@/components/admin/AvailabilityCalendar';

export const dynamic = 'force-dynamic';

export default async function AdminAvailabilityPage() {
  const now = new Date();
  const monthStr = format(now, 'yyyy-MM');
  const from = `${monthStr}-01`;
  // Cheap inclusive upper bound — a couple of days into the next month is
  // fine here since the client re-fetches the exact range on every month
  // change anyway; this is only the first paint.
  const through = format(new Date(now.getFullYear(), now.getMonth() + 1, 3), 'yyyy-MM-dd');

  const supabase = createServiceRoleClient();
  const [{ data: overrides }, { data: bookings }] = await Promise.all([
    supabase.from('slot_overrides').select('*').gte('date', from).lte('date', through).order('date', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, appointment_start, appointment_end, customer_name, status, services(name)')
      .in('status', ['pending_payment', 'confirmed'])
      .gte('appointment_start', `${from}T00:00:00Z`)
      .lt('appointment_start', `${through}T23:59:59Z`)
      .order('appointment_start', { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Availability</h1>
      <p className="mb-6 text-sm text-cream/60">
        Manage exceptions to the default 08:00–16:00 hourly booking grid — add extra bookable start times on any date,
        or block a specific unbooked default slot.
      </p>
      <AvailabilityCalendar
        initialMonth={monthStr}
        initialOverrides={overrides ?? []}
        initialBookings={(bookings as unknown as CalendarBooking[]) ?? []}
      />
    </div>
  );
}

// Kept local to the page rather than lib/booking/types.ts (owned by Agent B)
// — a minimal shape for the join query above.
type CalendarBooking = {
  id: string;
  appointment_start: string;
  appointment_end: string;
  customer_name: string;
  status: string;
  services: { name: string } | null;
};

import { createServiceRoleClient } from '@/lib/supabase/server';
import StudioHoursTable from '@/components/admin/StudioHoursTable';
import BookingSettingsForm from '@/components/admin/BookingSettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const supabase = createServiceRoleClient();
  const [{ data: hours }, { data: settings }] = await Promise.all([
    supabase.from('studio_hours').select('*').order('day_of_week', { ascending: true }),
    supabase.from('booking_settings').select('*').eq('id', true).single(),
  ]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="mb-6 font-serif text-2xl font-light">Working Hours</h1>
        <StudioHoursTable initialHours={hours ?? []} />
      </div>
      <div>
        <h1 className="mb-6 font-serif text-2xl font-light">Booking Settings</h1>
        <BookingSettingsForm
          initialSettings={settings ?? { buffer_minutes: 0, advance_booking_days: 60 }}
        />
      </div>
    </div>
  );
}

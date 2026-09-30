import { createServiceRoleClient } from '@/lib/supabase/server';
import StudioHoursTable from '@/components/admin/StudioHoursTable';
import BookingSettingsForm from '@/components/admin/BookingSettingsForm';
import ShippingSettingsForm from '@/components/admin/ShippingSettingsForm';
import type { DbShippingSettings } from '@/lib/shop/types';

export const dynamic = 'force-dynamic';

// Flat placeholder — Mirakle's real UK flat shipping rate is not knowable
// from anything in this codebase. £3.99 is a sensible high-street default;
// confirm the real cost with her before launch and update via this admin
// form (or the shipping_settings seed row in supabase/migrations).
const PLACEHOLDER_SHIPPING_SETTINGS: DbShippingSettings = {
  id: true,
  flat_rate_pence: 399,
  free_shipping_threshold_pence: null,
  updated_at: '',
};

export default async function AdminSettingsPage() {
  const supabase = createServiceRoleClient();
  const [{ data: hours }, { data: settings }, { data: shippingSettings }] = await Promise.all([
    supabase.from('studio_hours').select('*').order('day_of_week', { ascending: true }),
    supabase.from('booking_settings').select('*').eq('id', true).single(),
    supabase.from('shipping_settings').select('*').eq('id', true).single(),
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
      <div>
        <h1 className="mb-6 font-serif text-2xl font-light">Shipping</h1>
        <ShippingSettingsForm
          initialSettings={(shippingSettings as DbShippingSettings | null) ?? PLACEHOLDER_SHIPPING_SETTINGS}
        />
      </div>
    </div>
  );
}

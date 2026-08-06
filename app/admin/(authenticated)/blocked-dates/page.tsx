import { createServiceRoleClient } from '@/lib/supabase/server';
import BlockedDatesForm from '@/components/admin/BlockedDatesForm';

export const dynamic = 'force-dynamic';

export default async function AdminBlockedDatesPage() {
  const supabase = createServiceRoleClient();
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('*')
    .order('blocked_date', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Blocked Dates</h1>
      <BlockedDatesForm initialBlockedDates={blockedDates ?? []} />
    </div>
  );
}

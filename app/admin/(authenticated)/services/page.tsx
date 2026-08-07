import { createServiceRoleClient } from '@/lib/supabase/server';
import ServicesTable from '@/components/admin/ServicesTable';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const supabase = createServiceRoleClient();
  const { data: services } = await supabase
    .from('services')
    .select('*, service_categories(name)')
    .order('sort_order', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Services</h1>
      <ServicesTable initialServices={services ?? []} />
    </div>
  );
}

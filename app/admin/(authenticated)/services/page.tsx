import { createServiceRoleClient } from '@/lib/supabase/server';
import ServicesTable from '@/components/admin/ServicesTable';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const supabase = createServiceRoleClient();
  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase.from('services').select('*, service_categories(name)').order('sort_order', { ascending: true }),
    supabase.from('service_categories').select('*').order('sort_order', { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Services</h1>
      <p className="mb-6 text-sm text-cream/60">
        Create, edit, archive and reorder services. Manage categories on the{' '}
        <a href="/admin/service-categories" className="text-gold hover:underline">
          Service Categories
        </a>{' '}
        page.
      </p>
      <ServicesTable initialServices={services ?? []} categories={categories ?? []} />
    </div>
  );
}

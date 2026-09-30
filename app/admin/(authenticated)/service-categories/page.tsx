import { createServiceRoleClient } from '@/lib/supabase/server';
import ServiceCategoriesManager from '@/components/admin/ServiceCategoriesManager';

export const dynamic = 'force-dynamic';

export default async function AdminServiceCategoriesPage() {
  const supabase = createServiceRoleClient();
  const { data: categories } = await supabase
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Service Categories</h1>
      <p className="mb-6 text-sm text-cream/60">
        Create, rename, reorder and switch service categories on/off. Categories group services shown on the booking
        page and in the Services admin below.
      </p>
      <ServiceCategoriesManager initialCategories={categories ?? []} />
    </div>
  );
}

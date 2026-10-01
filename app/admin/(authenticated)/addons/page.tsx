import { createServiceRoleClient } from '@/lib/supabase/server';
import ServiceAddonsManager from '@/components/admin/ServiceAddonsManager';

export const dynamic = 'force-dynamic';

export default async function AdminAddonsPage() {
  const supabase = createServiceRoleClient();
  const [{ data: categories }, { data: addons }] = await Promise.all([
    supabase.from('service_categories').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase
      .from('service_addons')
      .select('*')
      .order('category_id', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true }),
  ]);

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Add-ons</h1>
      <p className="mb-6 text-sm text-cream/60">
        Category-scoped extras customers can add to a booking (e.g. Luxe Freestyle, Premium Slots) — each with its
        own price and duration change, which can be negative (e.g. a shorter style). The &quot;Hair Included
        Styles&quot; group applies whenever a customer books with hair included, regardless of which category the
        style itself belongs to.
      </p>
      <ServiceAddonsManager initialCategories={categories ?? []} initialAddons={addons ?? []} />
    </div>
  );
}

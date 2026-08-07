import { createServiceRoleClient } from '@/lib/supabase/server';
import BundleStockTable from '@/components/admin/BundleStockTable';

export const dynamic = 'force-dynamic';

export default async function AdminBundlesPage() {
  const supabase = createServiceRoleClient();
  const { data: variants } = await supabase
    .from('bundle_variants')
    .select('*')
    .order('inches', { ascending: true });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Bundle Stock</h1>
      <BundleStockTable initialVariants={variants ?? []} />
    </div>
  );
}

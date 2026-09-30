import { createServiceRoleClient } from '@/lib/supabase/server';
import BundleStockTable from '@/components/admin/BundleStockTable';
import ProductsManager from '@/components/admin/ProductsManager';

export const dynamic = 'force-dynamic';

export default async function AdminBundlesPage() {
  const supabase = createServiceRoleClient();
  const [{ data: variants }, { data: bundles }] = await Promise.all([
    supabase.from('bundle_variants').select('*').order('inches', { ascending: true }),
    supabase.from('bundles').select('*').order('name', { ascending: true }),
  ]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="mb-2 font-serif text-2xl font-light">Products &amp; Bundles</h1>
        <p className="mb-6 text-sm text-cream/60">
          Shared inventory for booking add-ons and the /shop storefront — create products, add length/colour variants,
          set price, stock quantity, image and description, and archive (rather than delete) anything retired.
        </p>
        <ProductsManager initialBundles={bundles ?? []} initialVariants={variants ?? []} />
      </div>
      <div>
        <h2 className="mb-2 font-serif text-xl font-light">Quick Stock Toggle</h2>
        <p className="mb-6 text-sm text-cream/60">Fast in/out-of-stock flip by length, grouped for a quick daily check.</p>
        <BundleStockTable initialVariants={variants ?? []} />
      </div>
    </div>
  );
}

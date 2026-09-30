import { createServiceRoleClient } from '@/lib/supabase/server';
import TrendingDealsManager from '@/components/admin/TrendingDealsManager';

export const dynamic = 'force-dynamic';

export default async function AdminTrendingDealsPage() {
  const supabase = createServiceRoleClient();
  const { data: category } = await supabase.from('service_categories').select('id').eq('slug', 'trending-deals').single();

  const { data: deals } = category
    ? await supabase.from('services').select('*').eq('category_id', category.id).order('sort_order', { ascending: true })
    : { data: [] };

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Trending Deals</h1>
      <p className="mb-6 text-sm text-cream/60">
        Create, edit, reorder and switch Trending Deals on/off. These are ordinary services in the &quot;Trending
        Deals&quot; category — the generic Services page can still edit them too.
      </p>
      <TrendingDealsManager initialDeals={deals ?? []} />
    </div>
  );
}

import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import ShopGrid from '@/components/shop/ShopGrid';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbBundle, DbBundleVariant } from '@/lib/booking/types';

export const metadata: Metadata = {
  title: 'Shop — MIRILUXE Studios',
  description:
    'Premium braiding hair, curly add-ons, wefts and aftercare — curated to pair with your appointment.',
};

export const revalidate = 0;

// Data source: the unified bundles/bundle_variants tables (same tables the
// booking-flow "add hair" upsell reads), not the static PRODUCTS array in
// lib/site.ts. Uses the service-role client (bypassing RLS) rather than the
// public anon client, because the public read policy on bundle_variants only
// exposes in_stock = true rows — we need out-of-stock rows too so the page
// can show "Currently unavailable" instead of silently hiding them.
export default async function ShopPage() {
  const supabase = createServiceRoleClient();
  const [{ data: bundles }, { data: variants }] = await Promise.all([
    supabase.from('bundles').select('*').eq('active', true),
    supabase.from('bundle_variants').select('*'),
  ]);

  return (
    <>
      <PageHero
        eyebrow="The Shop"
        title="Premium hair & aftercare"
        intro="Hand-picked bundles and essentials to pair with your style. Add any item to your appointment at checkout."
      />
      <ShopGrid bundles={(bundles as DbBundle[]) ?? []} variants={(variants as DbBundleVariant[]) ?? []} />
    </>
  );
}

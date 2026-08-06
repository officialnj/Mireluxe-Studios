import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceRoleClient();

  const [
    { data: categories, error: categoriesError },
    { data: services, error: servicesError },
    { data: bundles, error: bundlesError },
    { data: bundleVariants, error: variantsError },
  ] = await Promise.all([
    supabase.from('service_categories').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('services').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('bundles').select('*').eq('active', true),
    supabase.from('bundle_variants').select('*').eq('in_stock', true),
  ]);

  if (categoriesError || servicesError || bundlesError || variantsError) {
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }

  return NextResponse.json({
    categories: categories ?? [],
    services: services ?? [],
    bundles: bundles ?? [],
    bundleVariants: bundleVariants ?? [],
  });
}

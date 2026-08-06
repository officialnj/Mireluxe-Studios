import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServiceRoleClient();

  const [{ data: services, error: servicesError }, { data: bundles, error: bundlesError }] = await Promise.all([
    supabase.from('services').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('bundles').select('*').eq('active', true),
  ]);

  if (servicesError || bundlesError) {
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }

  return NextResponse.json({ services: services ?? [], bundles: bundles ?? [] });
}

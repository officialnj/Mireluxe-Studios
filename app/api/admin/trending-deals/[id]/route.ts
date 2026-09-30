import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const TRENDING_DEALS_SLUG = 'trending-deals';

const bodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  note: z.string().trim().nullable().optional(),
  base_price_pence: z.number().int().min(0).optional(),
  hair_incl_price_pence: z.number().int().min(0).nullable().optional(),
  service_time_mins: z.number().int().min(1).nullable().optional(),
  deposit_pence: z.number().int().min(0).optional(),
  morning_only: z.boolean().optional(),
  included_bundle_count: z.number().int().min(0).optional(),
  included_bundle_inches: z.number().int().min(0).nullable().optional(),
  // "on/off" — services.active already does the job, no new column needed.
  active: z.boolean().optional(),
});

/**
 * PATCH — edit a Trending Deals service row. Scoped to services whose
 * category is 'trending-deals' so this dedicated endpoint can't be used to
 * edit an arbitrary service from another category (defense in depth beyond
 * the admin-auth check — this is a narrower surface than the generic
 * /api/admin/services/[id] route).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: service } = await supabase
    .from('services')
    .select('id, category_id, service_categories(slug)')
    .eq('id', params.id)
    .single();

  const categorySlug = (service as unknown as { service_categories: { slug: string } | null } | null)?.service_categories?.slug;
  if (!service || categorySlug !== TRENDING_DEALS_SLUG) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error } = await supabase.from('services').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

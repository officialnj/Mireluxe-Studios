import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const TRENDING_DEALS_SLUG = 'trending-deals';

const bodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  note: z.string().trim().nullable().optional(),
  base_price_pence: z.number().int().min(0),
  hair_incl_price_pence: z.number().int().min(0).nullable().optional(),
  service_time_mins: z.number().int().min(1).nullable().optional(),
  deposit_pence: z.number().int().min(0).optional(),
  morning_only: z.boolean().optional(),
  included_bundle_count: z.number().int().min(0).optional(),
  included_bundle_inches: z.number().int().min(0).nullable().optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'deal'
  );
}

/**
 * Trending Deals has no dedicated table — it's the `service_categories` row
 * with slug='trending-deals', joined to ordinary `services` rows (same
 * catalogue the generic Services admin page edits). This route scopes
 * create/list to that one category so this dedicated UI can't touch
 * unrelated services.
 */
async function getTrendingDealsCategoryId(supabase: ReturnType<typeof createServiceRoleClient>): Promise<string | null> {
  const { data } = await supabase.from('service_categories').select('id').eq('slug', TRENDING_DEALS_SLUG).single();
  return data?.id ?? null;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const categoryId = await getTrendingDealsCategoryId(supabase);
  if (!categoryId) return NextResponse.json({ deals: [] });

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ deals: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const categoryId = await getTrendingDealsCategoryId(supabase);
  if (!categoryId) return NextResponse.json({ error: 'category_missing' }, { status: 500 });

  const { data: existing } = await supabase
    .from('services')
    .select('sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const depositPence = parsed.data.deposit_pence ?? Math.round((parsed.data.base_price_pence * 0.25) / 500) * 500;

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from('services')
      .insert({
        category_id: categoryId,
        slug,
        name: parsed.data.name,
        description: parsed.data.description,
        note: parsed.data.note ?? null,
        base_price_pence: parsed.data.base_price_pence,
        hair_incl_price_pence: parsed.data.hair_incl_price_pence ?? null,
        service_time_mins: parsed.data.service_time_mins ?? null,
        deposit_pence: depositPence,
        morning_only: parsed.data.morning_only ?? false,
        included_bundle_count: parsed.data.included_bundle_count ?? 0,
        included_bundle_inches: parsed.data.included_bundle_inches ?? null,
        sort_order: nextSortOrder,
        active: true,
      })
      .select('*')
      .single();

    if (!error) {
      revalidatePublicPages();
      return NextResponse.json({ deal: data });
    }
    if (error.code !== '23505') return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    slug = `${baseSlug}-${attempt + 2}`; // slug collision, retry with a suffix
  }

  return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
}

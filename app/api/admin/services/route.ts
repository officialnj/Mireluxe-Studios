import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  category_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  size: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1),
  note: z.string().trim().nullable().optional(),
  base_price_pence: z.number().int().min(0),
  hair_incl_price_pence: z.number().int().min(0).nullable().optional(),
  service_time_mins: z.number().int().min(1).nullable().optional(),
  hair_incl_service_time_mins: z.number().int().min(1).nullable().optional(),
  style_duration_weeks: z.string().trim().nullable().optional(),
  xpression_packs: z.string().trim().nullable().optional(),
  morning_only: z.boolean().optional(),
  included_bundle_count: z.number().int().min(0).optional(),
  included_bundle_inches: z.number().int().min(0).nullable().optional(),
  deposit_pence: z.number().int().min(0).optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'service'
  );
}

/**
 * GET — full service catalogue (all categories), joined to category name for
 * display. Used by the generic Services admin page, distinct from the
 * category-scoped /api/admin/trending-deals GET.
 */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_categories(name)')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ services: data ?? [] });
}

/**
 * POST — create a brand-new service in any category. Slug auto-generated
 * from name with collision retry (same pattern as
 * /api/admin/trending-deals and /api/admin/service-categories).
 * sort_order is appended after the last service in the chosen category so
 * per-category reordering (see /api/admin/services/reorder) stays coherent.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: category } = await supabase
    .from('service_categories')
    .select('id')
    .eq('id', parsed.data.category_id)
    .single();
  if (!category) return NextResponse.json({ error: 'category_not_found' }, { status: 400 });

  const { data: existing } = await supabase
    .from('services')
    .select('sort_order')
    .eq('category_id', parsed.data.category_id)
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
        category_id: parsed.data.category_id,
        slug,
        name: parsed.data.name,
        size: parsed.data.size ?? null,
        description: parsed.data.description,
        note: parsed.data.note ?? null,
        base_price_pence: parsed.data.base_price_pence,
        hair_incl_price_pence: parsed.data.hair_incl_price_pence ?? null,
        service_time_mins: parsed.data.service_time_mins ?? null,
        hair_incl_service_time_mins: parsed.data.hair_incl_service_time_mins ?? null,
        style_duration_weeks: parsed.data.style_duration_weeks ?? null,
        xpression_packs: parsed.data.xpression_packs ?? null,
        morning_only: parsed.data.morning_only ?? false,
        included_bundle_count: parsed.data.included_bundle_count ?? 0,
        included_bundle_inches: parsed.data.included_bundle_inches ?? null,
        deposit_pence: depositPence,
        sort_order: nextSortOrder,
        active: true,
      })
      .select('*, service_categories(name)')
      .single();

    if (!error) {
      revalidatePublicPages();
      return NextResponse.json({ service: data });
    }
    if (error.code !== '23505') return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    slug = `${baseSlug}-${attempt + 2}`; // slug collision, retry with a suffix
  }

  return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Null = the virtual "Hair Included Styles" bucket — see
  // supabase/migrations/0019_booking_v2_categories_addons.sql.
  category_id: z.string().min(1).nullable(),
  name: z.string().trim().min(1),
  price_delta_pence: z.number().int(),
  duration_delta_mins: z.number().int(),
  unlocks_premium_slots: z.boolean().optional().default(false),
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_addons')
    .select('*')
    .order('category_id', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ addons: data ?? [] });
}

/**
 * POST — create a new add-on, scoped to a category (or the null Hair
 * Included Styles bucket). Appended to the end of its bucket's order.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  let existingQuery = supabase.from('service_addons').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  existingQuery = parsed.data.category_id === null ? existingQuery.is('category_id', null) : existingQuery.eq('category_id', parsed.data.category_id);
  const { data: existing } = await existingQuery;
  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('service_addons')
    .insert({ ...parsed.data, sort_order: nextSortOrder, active: true })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ addon: data });
}

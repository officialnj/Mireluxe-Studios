import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  // Null = the virtual "Hair Included Styles" bucket.
  category_id: z.string().min(1).nullable(),
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * POST — reorder add-ons within a single category bucket (or the null Hair
 * Included Styles bucket). Same defense-in-depth pattern as
 * /api/admin/services/reorder: rejects if the submitted id set doesn't
 * exactly match that bucket's current members.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  let currentQuery = supabase.from('service_addons').select('id');
  currentQuery = parsed.data.category_id === null ? currentQuery.is('category_id', null) : currentQuery.eq('category_id', parsed.data.category_id);
  const { data: current } = await currentQuery;
  const currentIds = new Set((current ?? []).map((a) => a.id));
  const submittedIds = parsed.data.orderedIds;

  if (submittedIds.length !== currentIds.size || submittedIds.some((id) => !currentIds.has(id))) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  const results = await Promise.all(
    submittedIds.map((id, index) => supabase.from('service_addons').update({ sort_order: index }).eq('id', id))
  );
  if (results.some((r) => r.error)) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

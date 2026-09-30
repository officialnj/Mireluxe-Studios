import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  category_id: z.string().trim().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * POST — reorder services within a single category. Writes
 * services.sort_order = index for each id, scoped to category_id. Rejects if
 * the submitted id set doesn't exactly match that category's current
 * members, same defense-in-depth pattern as /api/admin/trending-deals/reorder
 * and /api/admin/service-categories/reorder.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: current } = await supabase.from('services').select('id').eq('category_id', parsed.data.category_id);
  const currentIds = new Set((current ?? []).map((s) => s.id));
  const submittedIds = parsed.data.orderedIds;

  if (submittedIds.length !== currentIds.size || submittedIds.some((id) => !currentIds.has(id))) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  const results = await Promise.all(
    submittedIds.map((id, index) => supabase.from('services').update({ sort_order: index }).eq('id', id))
  );
  if (results.some((r) => r.error)) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

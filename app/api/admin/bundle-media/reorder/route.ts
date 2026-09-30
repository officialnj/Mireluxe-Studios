import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  bundle_variant_id: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * POST — reorder a single variant's media gallery. Writes bundle_media.sort_order
 * = index for each id, scoped to the given bundle_variant_id. Rejects if the
 * submitted id set doesn't exactly match that variant's current media rows,
 * mirroring app/api/admin/trending-deals/reorder/route.ts so this can't be
 * used to silently drop or smuggle in a media row belonging to another variant.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: current } = await supabase
    .from('bundle_media')
    .select('id')
    .eq('bundle_variant_id', parsed.data.bundle_variant_id);
  const currentIds = new Set((current ?? []).map((r) => r.id));
  const submittedIds = parsed.data.orderedIds;

  if (submittedIds.length !== currentIds.size || submittedIds.some((id) => !currentIds.has(id))) {
    return NextResponse.json({ error: 'id_mismatch' }, { status: 400 });
  }

  const results = await Promise.all(
    submittedIds.map((id, index) => supabase.from('bundle_media').update({ sort_order: index }).eq('id', id))
  );
  if (results.some((r) => r.error)) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

/** POST — persist a new display order for gallery images. Writes each row's
 *  sort_order to its index in the supplied array. */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const results = await Promise.all(
    parsed.data.orderedIds.map((id, index) =>
      supabase.from('gallery_images').update({ sort_order: index }).eq('id', id)
    )
  );
  if (results.some((r) => r.error)) return NextResponse.json({ error: 'reorder_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

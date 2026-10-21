import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // Path within the public `product-media` Storage bucket (prefix `gallery/`).
  // The browser already uploaded the file directly to Storage using the
  // admin's own authenticated session — we only persist the resulting path.
  storage_path: z.string().min(1),
  caption: z.string().trim().max(200).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/** GET — list all gallery_images rows, ordered for display. */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ images: data ?? [] });
}

/** POST — record a gallery_images row for a file the browser already uploaded
 *  straight to Supabase Storage. */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  let sortOrder = parsed.data.sort_order;
  if (sortOrder === undefined) {
    const { data: existing } = await supabase
      .from('gallery_images')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from('gallery_images')
    .insert({
      storage_path: parsed.data.storage_path,
      caption: parsed.data.caption ?? null,
      sort_order: sortOrder,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ image: data });
}

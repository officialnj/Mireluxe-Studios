import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bundle_variant_id: z.string().min(1),
  media_type: z.enum(['image', 'video']),
  // Path within the public `product-media` Storage bucket — the browser has
  // already uploaded the underlying file(s) directly to Storage (using the
  // admin's own authenticated session) by the time this route is called; we
  // only ever persist the resulting path, never handle file bytes here (a
  // 100MB video body would risk exceeding serverless function limits).
  storage_path: z.string().min(1),
  poster_storage_path: z.string().min(1).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/**
 * GET — list bundle_media rows, optionally filtered to one variant via
 * ?bundle_variant_id=. Used by ProductsManager to hydrate each variant's
 * already-uploaded media on load.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const bundleVariantId = request.nextUrl.searchParams.get('bundle_variant_id');
  const supabase = createServiceRoleClient();
  let query = supabase.from('bundle_media').select('*').order('sort_order', { ascending: true });
  if (bundleVariantId) query = query.eq('bundle_variant_id', bundleVariantId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ media: data ?? [] });
}

/**
 * POST — record a bundle_media row for a file the browser has already
 * uploaded straight to Supabase Storage (see components/admin/ProductsManager.tsx
 * for the upload + poster-capture flow). Uses the service-role client to
 * bypass RLS on the insert, which is safe here because the admin-auth check
 * above already gated this request, and the storage object itself was only
 * writable by an authenticated admin session in the first place.
 */
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
      .from('bundle_media')
      .select('sort_order')
      .eq('bundle_variant_id', parsed.data.bundle_variant_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from('bundle_media')
    .insert({
      bundle_variant_id: parsed.data.bundle_variant_id,
      media_type: parsed.data.media_type,
      storage_path: parsed.data.storage_path,
      poster_storage_path: parsed.data.poster_storage_path ?? null,
      sort_order: sortOrder,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ media: data });
}

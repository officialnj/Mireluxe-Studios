import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().trim().min(1),
});

/** GET — list bundles (product lines). Small table, no pagination needed. */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('bundles').select('*').order('name', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ bundles: data ?? [] });
}

/**
 * POST — create a new bundle (product line), e.g. "Curly Bulk Bundle". Its
 * sellable inventory rows live in bundle_variants (inches/colour/price/
 * stock/image/description) — see /api/admin/bundle-variants.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('bundles').insert({ name: parsed.data.name }).select('*').single();
  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ bundle: data });
}

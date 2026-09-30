import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bundle_id: z.string().min(1),
  inches: z.number().int().min(1),
  colour: z.string().trim().min(1),
  price_pence: z.number().int().min(0),
  stock_quantity: z.number().int().min(0).default(0),
  in_stock: z.boolean().default(true),
  image_url: z.string().trim().url().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

/**
 * POST — create a new sellable variant under a bundle (product line). This
 * table is the shared inventory for both booking add-ons and the /shop
 * storefront (Agent E), hence image_url/description/stock_quantity — see
 * supabase/migrations/0007_v2_booking_lifecycle_overrides_inventory.sql.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('bundle_variants').insert(parsed.data).select('*').single();

  if (error) {
    // unique (bundle_id, inches, colour)
    if (error.code === '23505') return NextResponse.json({ error: 'duplicate_variant' }, { status: 409 });
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  revalidatePublicPages();
  return NextResponse.json({ variant: data });
}

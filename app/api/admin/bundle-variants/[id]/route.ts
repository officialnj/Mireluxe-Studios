import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

// Extended for the full product CRUD (Agent D) beyond the original in_stock
// toggle (BundleStockTable.tsx, unchanged, still only ever sends in_stock —
// every field here stays optional so that call keeps working as-is).
const bodySchema = z.object({
  in_stock: z.boolean().optional(),
  price_pence: z.number().int().min(0).optional(),
  inches: z.number().int().min(1).optional(),
  colour: z.string().trim().min(1).optional(),
  stock_quantity: z.number().int().min(0).optional(),
  image_url: z.string().trim().url().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('bundle_variants').update(parsed.data).eq('id', params.id);
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'duplicate_variant' }, { status: 409 });
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

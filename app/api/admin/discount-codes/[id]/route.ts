import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

// `used_count` is intentionally excluded — it is only ever incremented by
// the checkout/webhook flow (see lib/shop/discounts.ts), never edited here.
// There is no DELETE handler: deletion lock — deactivate via `active` instead.
const bodySchema = z
  .object({
    code: z.string().trim().min(1).max(50).optional(),
    discount_type: z.enum(['percent', 'fixed']).optional(),
    value: z.number().int().min(1).optional(),
    usage_limit: z.number().int().min(1).nullable().optional(),
    min_subtotal_pence: z.number().int().min(0).optional(),
    expires_at: z.string().datetime().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.discount_type !== 'percent' || data.value == null || data.value <= 100, {
    message: 'percent value must be 1-100',
    path: ['value'],
  });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.data };
  if (typeof update.code === 'string') update.code = update.code.trim().toUpperCase();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'code_already_exists' }, { status: 409 });
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  revalidatePublicPages();
  return NextResponse.json({ discountCode: data });
}

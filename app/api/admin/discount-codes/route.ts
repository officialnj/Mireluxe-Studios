import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    discount_type: z.enum(['percent', 'fixed']),
    value: z.number().int().min(1),
    usage_limit: z.number().int().min(1).nullable().optional(),
    min_subtotal_pence: z.number().int().min(0).optional(),
    expires_at: z.string().datetime().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.discount_type !== 'percent' || data.value <= 100, {
    message: 'percent value must be 1-100',
    path: ['value'],
  });

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ discountCodes: data ?? [] });
}

/**
 * POST — create a discount code. Codes are stored uppercase (normalized
 * here) so lookups in lib/shop/discounts.ts (which also uppercase-normalize
 * the customer-entered code) are a simple case-sensitive equality match.
 * Deletion lock applies here too: there is no DELETE route — an unwanted
 * code is deactivated via PATCH, never removed.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      code: parsed.data.code.trim().toUpperCase(),
      discount_type: parsed.data.discount_type,
      value: parsed.data.value,
      usage_limit: parsed.data.usage_limit ?? null,
      min_subtotal_pence: parsed.data.min_subtotal_pence ?? 0,
      expires_at: parsed.data.expires_at ?? null,
      active: parsed.data.active ?? true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'code_already_exists' }, { status: 409 });
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  revalidatePublicPages();
  return NextResponse.json({ discountCode: data });
}

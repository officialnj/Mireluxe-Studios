import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  category_id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  size: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1).optional(),
  note: z.string().trim().nullable().optional(),
  base_price_pence: z.number().int().min(0).optional(),
  hair_incl_price_pence: z.number().int().min(0).nullable().optional(),
  service_time_mins: z.number().int().min(1).nullable().optional(),
  hair_incl_service_time_mins: z.number().int().min(1).nullable().optional(),
  style_duration_weeks: z.string().trim().nullable().optional(),
  xpression_packs: z.string().trim().nullable().optional(),
  morning_only: z.boolean().optional(),
  included_bundle_count: z.number().int().min(0).optional(),
  included_bundle_inches: z.number().int().min(0).nullable().optional(),
  deposit_pence: z.number().int().min(0).optional(),
  // Deletion lock: no DELETE route. Archive via active=false instead.
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from('service_categories')
      .select('id')
      .eq('id', parsed.data.category_id)
      .single();
    if (!category) return NextResponse.json({ error: 'category_not_found' }, { status: 400 });
  }

  const { error } = await supabase.from('services').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

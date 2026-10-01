import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  price_delta_pence: z.number().int().optional(),
  duration_delta_mins: z.number().int().optional(),
  unlocks_premium_slots: z.boolean().optional(),
  // Deletion lock: no DELETE route. Deactivate via active=false instead.
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('service_addons').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}

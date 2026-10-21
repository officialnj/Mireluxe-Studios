import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  // 'clear' un-marks (balance owing again); otherwise the method it was paid by.
  method: z.enum(['cash', 'card', 'other', 'clear']),
});

/**
 * Mark (or un-mark) an appointment's remaining balance as collected in-studio.
 * The deposit was already taken online; this just records that the rest was
 * settled on the day, so it drops off the Checkout "to collect" list.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const clear = parsed.data.method === 'clear';
  const { error } = await supabase
    .from('bookings')
    .update({
      balance_collected_at: clear ? null : new Date().toISOString(),
      balance_payment_method: clear ? null : parsed.data.method,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

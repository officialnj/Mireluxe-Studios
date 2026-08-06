import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

const bodySchema = z.object({ refund: z.boolean().optional() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const refund = parsed.success ? (parsed.data.refund ?? true) : true;

  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', params.id).single();
  if (error || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (refund && booking.status === 'confirmed' && booking.stripe_payment_intent_id) {
    try {
      await getStripe().refunds.create({ payment_intent: booking.stripe_payment_intent_id });
    } catch {
      return NextResponse.json({ error: 'refund_failed' }, { status: 502 });
    }
  }

  const { error: updateError } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', params.id);
  if (updateError) return NextResponse.json({ error: 'cancel_failed' }, { status: 500 });

  return NextResponse.json({ ok: true });
}

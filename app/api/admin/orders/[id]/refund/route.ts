import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { revalidatePublicPages } from '@/lib/revalidate';

/**
 * Refunds a paid shop order in full via Stripe and marks it cancelled.
 * Mirrors app/api/admin/bookings/[id]/cancel/route.ts. The refund amount is
 * never taken from the client — Stripe refunds the full payment intent
 * amount by default, which is what was actually charged.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: order, error } = await supabase.from('shop_orders').select('*').eq('id', params.id).single();
  if (error || !order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (order.status !== 'paid') return NextResponse.json({ error: 'not_paid' }, { status: 409 });

  if (order.stripe_payment_intent_id) {
    try {
      await getStripe().refunds.create({ payment_intent: order.stripe_payment_intent_id });
    } catch {
      return NextResponse.json({ error: 'refund_failed' }, { status: 502 });
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('shop_orders')
    .update({ status: 'cancelled', fulfillment_status: 'cancelled' })
    .eq('id', params.id)
    .select('*')
    .single();
  if (updateError || !updated) return NextResponse.json({ error: 'cancel_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ order: updated });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({
  fulfillment_status: z.enum(['unfulfilled', 'fulfilled', 'shipped', 'delivered', 'cancelled']).optional(),
  tracking_number: z.string().trim().max(200).nullable().optional(),
  tracking_carrier: z.string().trim().max(120).nullable().optional(),
  admin_notes: z.string().trim().max(5000).nullable().optional(),
});

/**
 * Fulfillment/tracking/notes updates for a single shop order. Payment status
 * (`status`) is never editable here — that only changes via the Stripe
 * webhook (paid) or the refund route (cancelled).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const { fulfillment_status, tracking_number, tracking_carrier, admin_notes } = parsed.data;

  if (
    fulfillment_status === undefined &&
    tracking_number === undefined &&
    tracking_carrier === undefined &&
    admin_notes === undefined
  ) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: order, error: fetchError } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('id', params.id)
    .single();
  if (fetchError || !order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Fulfillment actions (status/tracking) only make sense for orders that
  // actually got paid — a pending_payment or cancelled order has nothing to
  // ship. admin_notes is exempt so admins can leave context on any order.
  const changingFulfillment = fulfillment_status !== undefined || tracking_number !== undefined || tracking_carrier !== undefined;
  if (changingFulfillment && order.status !== 'paid') {
    return NextResponse.json({ error: 'not_paid' }, { status: 409 });
  }

  const update: Record<string, unknown> = {};
  if (fulfillment_status !== undefined) {
    update.fulfillment_status = fulfillment_status;
    // Server-computed, never trust a client-sent timestamp: only stamp
    // shipped_at the moment the status actually transitions to 'shipped'.
    if (fulfillment_status === 'shipped') {
      update.shipped_at = new Date().toISOString();
    }
  }
  if (tracking_number !== undefined) update.tracking_number = tracking_number?.trim() || null;
  if (tracking_carrier !== undefined) update.tracking_carrier = tracking_carrier?.trim() || null;
  if (admin_notes !== undefined) update.admin_notes = admin_notes?.trim() || null;

  const { data: updated, error: updateError } = await supabase
    .from('shop_orders')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();
  if (updateError || !updated) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ order: updated });
}

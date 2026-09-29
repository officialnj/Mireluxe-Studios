import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { PRODUCTS } from '@/lib/site';

// Flat placeholder — real UK shipping rates aren't knowable from anything
// in this codebase (PRODUCTS has no weight data). Confirm real cost with
// Mirakle before launch.
const SHOP_SHIPPING_PENCE = 0;

const payloadSchema = z.object({
  items: z.array(
    z.object({
      slug: z.string(),
      quantity: z.number().int().min(1).max(20),
    })
  ).min(1),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().max(50).optional(),
  shipping: z.object({
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    postcode: z.string().trim().min(1).max(20),
    country: z.string().trim().min(2).max(2).default('GB'),
  }),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  // Never trust client-submitted prices — re-derive every line from the
  // server-side PRODUCTS catalogue by slug, same principle already used
  // for booking pricing in app/api/bookings/route.ts.
  const resolvedItems: { slug: string; name: string; quantity: number; pricePence: number }[] = [];
  for (const item of payload.items) {
    const product = PRODUCTS.find((p) => p.slug === item.slug);
    if (!product) {
      return NextResponse.json({ error: 'product_not_found', slug: item.slug }, { status: 400 });
    }
    resolvedItems.push({ slug: product.slug, name: product.name, quantity: item.quantity, pricePence: product.pricePence });
  }

  const subtotalPence =
    resolvedItems.reduce((sum, item) => sum + item.pricePence * item.quantity, 0) + SHOP_SHIPPING_PENCE;

  const supabase = createServiceRoleClient();
  const { data: order, error: insertError } = await supabase
    .from('shop_orders')
    .insert({
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone ?? null,
      shipping_line1: payload.shipping.line1,
      shipping_line2: payload.shipping.line2 ?? null,
      shipping_city: payload.shipping.city,
      shipping_postcode: payload.shipping.postcode,
      shipping_country: payload.shipping.country,
      items: resolvedItems,
      subtotal_pence: subtotalPence,
    })
    .select()
    .single();

  if (insertError || !order) {
    return NextResponse.json({ error: 'order_failed' }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: subtotalPence,
      currency: 'gbp',
      metadata: { shop_order_id: order.id },
      receipt_email: payload.customerEmail,
    });

    await supabase.from('shop_orders').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', order.id);

    return NextResponse.json({ orderId: order.id, clientSecret: paymentIntent.client_secret });
  } catch {
    await supabase.from('shop_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'payment_setup_failed' }, { status: 502 });
  }
}

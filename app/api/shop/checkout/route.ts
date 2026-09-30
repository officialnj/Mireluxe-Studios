import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { computeShippingPence } from '@/lib/shop/shipping';
import { validateAndApplyDiscount } from '@/lib/shop/discounts';
import type { DbBundleVariant } from '@/lib/booking/types';
import type { DbShippingSettings } from '@/lib/shop/types';

// Explicitly-flagged placeholder — matches the admin Settings page's own
// fallback (see components/admin/ShippingSettingsForm.tsx). Real UK shipping
// rates need Mirakle's actual numbers via /admin/settings.
const FALLBACK_SHIPPING_SETTINGS: DbShippingSettings = {
  id: true,
  flat_rate_pence: 399,
  free_shipping_threshold_pence: null,
  updated_at: '',
};

const payloadSchema = z.object({
  items: z.array(
    z.object({
      // Historically a PRODUCTS[].slug; the /shop storefront now reads the
      // unified bundles/bundle_variants tables (Agent E), so the cart's
      // generic ProductLine.slug field is populated with the
      // bundle_variants.id (uuid) instead. Field name kept as `slug` to
      // avoid a frontend/cart-shape change — see components/shop/BundleCard.tsx.
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
  /** Optional discount code — validated server-side, never trust a
   *  client-sent discount amount. */
  discountCode: z.string().trim().max(50).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;
  const supabase = createServiceRoleClient();

  // Never trust client-submitted prices or stock state — re-resolve every
  // line from bundle_variants server-side. Effective purchasability is
  // in_stock = true AND stock_quantity > 0, the same gate already enforced
  // for booking add-ons in app/api/bookings/route.ts — a direct API call
  // must never be able to buy an out-of-stock or delisted variant.
  const variantIds = payload.items.map((item) => item.slug);
  const [{ data: variants }, { data: bundles }] = await Promise.all([
    supabase.from('bundle_variants').select('*').in('id', variantIds).eq('in_stock', true).gt('stock_quantity', 0),
    supabase.from('bundles').select('*'),
  ]);
  const variantsById = new Map((variants as DbBundleVariant[] | null ?? []).map((v) => [v.id, v]));
  const bundleNameById = new Map((bundles ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

  const resolvedItems: { slug: string; name: string; quantity: number; pricePence: number }[] = [];
  for (const item of payload.items) {
    const variant = variantsById.get(item.slug);
    if (!variant) {
      return NextResponse.json({ error: 'bundle_variant_unavailable', slug: item.slug }, { status: 400 });
    }
    if (item.quantity > variant.stock_quantity) {
      return NextResponse.json({ error: 'insufficient_stock', slug: item.slug }, { status: 400 });
    }
    const bundleName = bundleNameById.get(variant.bundle_id) ?? 'Braiding Hair Bundle';
    resolvedItems.push({
      slug: variant.id,
      name: `${bundleName} — ${variant.inches}" ${variant.colour}`,
      quantity: item.quantity,
      pricePence: variant.price_pence,
    });
  }

  const merchandisePence = resolvedItems.reduce((sum, item) => sum + item.pricePence * item.quantity, 0);

  // Shipping is computed on the pre-discount merchandise total, so a coupon
  // can never zero out or negate the shipping charge.
  const { data: shippingSettingsRow } = await supabase.from('shipping_settings').select('*').eq('id', true).single();
  const shippingPence = computeShippingPence(
    merchandisePence,
    (shippingSettingsRow as DbShippingSettings | null) ?? FALLBACK_SHIPPING_SETTINGS
  );

  let discountPence = 0;
  let discountCodeId: string | null = null;
  if (payload.discountCode) {
    const result = await validateAndApplyDiscount(supabase, payload.discountCode, merchandisePence);
    if (!result.valid) {
      return NextResponse.json({ error: 'invalid_discount_code', reason: result.reason }, { status: 400 });
    }
    discountPence = result.discountPence;
    discountCodeId = result.discountCodeId;
  }

  const subtotalPence = merchandisePence - discountPence + shippingPence;

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
      discount_code_id: discountCodeId,
      discount_pence: discountPence,
      shipping_pence: shippingPence,
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

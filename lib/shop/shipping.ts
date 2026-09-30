import type { DbShippingSettings } from '@/lib/shop/types';

// ─────────────────────────────────────────────────────────────────────────
// Integration notes for app/api/shop/checkout/route.ts (owned by another
// workstream — not edited here, see below for the exact slot-in point).
//
// The route currently hardcodes:
//
//   const SHOP_SHIPPING_PENCE = 0; // placeholder
//   const subtotalPence =
//     resolvedItems.reduce((sum, item) => sum + item.pricePence * item.quantity, 0) + SHOP_SHIPPING_PENCE;
//
// Replace that with a real lookup + calculation. After `resolvedItems` is
// built and the pre-shipping merchandise total is summed, fetch the
// singleton `shipping_settings` row via the service-role client (already in
// scope as `supabase` in that route) and call `computeShippingPence`:
//
//   const merchandisePence = resolvedItems.reduce((sum, item) => sum + item.pricePence * item.quantity, 0);
//
//   const { data: shippingSettingsRow } = await supabase
//     .from('shipping_settings')
//     .select('*')
//     .eq('id', true)
//     .single();
//   const shippingPence = computeShippingPence(
//     merchandisePence,
//     (shippingSettingsRow as DbShippingSettings | null) ?? { id: true, flat_rate_pence: 399, free_shipping_threshold_pence: null, updated_at: '' }
//   );
//
//   const subtotalPence = merchandisePence + shippingPence;
//
// Use `subtotalPence` as before for the Stripe PaymentIntent `amount` and
// the `shop_orders.subtotal_pence` column. If the other in-flight
// workstream (discount codes) is also wiring in at this point, shipping
// should be computed on the merchandise subtotal BEFORE any discount is
// applied — i.e. `chargePence = merchandisePence - discountPence + shippingPence`
// — so a coupon can never accidentally zero out or negate the shipping
// charge. Consider also storing `shippingPence` on the `shop_orders` row
// (a new `shipping_pence` column) so admin order views and any future
// refund logic can see the breakdown rather than only a combined total.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Computes the shipping charge (in pence) for a given merchandise subtotal,
 * given the admin-configured `shipping_settings` singleton row.
 *
 * Pure function — no I/O, no side effects. If a free-shipping threshold is
 * configured and the subtotal meets or exceeds it, shipping is free ($0);
 * otherwise the flat rate applies.
 */
export function computeShippingPence(subtotalPence: number, settings: DbShippingSettings): number {
  if (settings.free_shipping_threshold_pence != null && subtotalPence >= settings.free_shipping_threshold_pence) {
    return 0;
  }
  return settings.flat_rate_pence;
}

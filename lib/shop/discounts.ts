import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbDiscountCode } from '@/lib/shop/types';

// ─────────────────────────────────────────────────────────────────────────
// Integration notes for app/api/shop/checkout/route.ts (owned by another
// workstream — not edited here, see below for the exact slot-in points).
//
// 1. Validation + pricing (checkout-creation time):
//    After `resolvedItems` is built and `subtotalPence` is computed (the
//    pre-discount, pre-shipping sum of `pricePence * quantity`), and BEFORE
//    the Stripe PaymentIntent is created:
//
//      let discountPence = 0;
//      let discountCodeId: string | null = null;
//      if (payload.discountCode) {
//        const result = await validateAndApplyDiscount(supabase, payload.discountCode, subtotalPence);
//        if (!result.valid) {
//          return NextResponse.json({ error: 'invalid_discount_code', reason: result.reason }, { status: 400 });
//        }
//        discountPence = result.discountPence;
//        discountCodeId = result.discountCodeId;
//      }
//      const chargePence = subtotalPence - discountPence + SHOP_SHIPPING_PENCE;
//
//    Use `chargePence` (not `subtotalPence`) as the Stripe PaymentIntent
//    `amount`. Store `discountCodeId` and `discountPence` on the
//    `shop_orders` row (e.g. new `discount_code_id` / `discount_pence`
//    columns) so the webhook below can find them again, and so admin order
//    views can show the applied discount.
//
// 2. Committing the usage (Stripe webhook, NOT the checkout route):
//    Call `incrementDiscountUsage(supabase, discountCodeId)` only from the
//    webhook handler (app/api/webhooks/stripe/route.ts) at the point where
//    a `payment_intent.succeeded` event confirms the order's payment — the
//    same place `shop_orders.status` gets flipped to 'paid'. Do NOT call it
//    in this route: a PaymentIntent can be created here and then abandoned
//    (customer closes the tab, card declines, etc.), and abandoned attempts
//    must not burn down a limited-use code's `usage_limit`.
// ─────────────────────────────────────────────────────────────────────────

export type DiscountValidationResult =
  | { valid: true; discountPence: number; discountCodeId: string }
  | { valid: false; reason: string };

/**
 * Looks up a discount code (case-insensitive — normalize to uppercase both
 * here and wherever a code is stored/created) and validates it against the
 * given subtotal. Pure/read-only: does NOT increment `used_count`, so it is
 * safe to call repeatedly for live cart-total previews as well as at
 * checkout-creation time. Call `incrementDiscountUsage` separately, and only
 * once payment is actually confirmed (see comment block above).
 */
export async function validateAndApplyDiscount(
  supabase: SupabaseClient,
  code: string,
  subtotalPence: number
): Promise<DiscountValidationResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { valid: false, reason: 'code_required' };

  const { data: discountCode, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', normalizedCode)
    .single();

  if (error || !discountCode) return { valid: false, reason: 'not_found' };

  const row = discountCode as DbDiscountCode;

  if (!row.active) return { valid: false, reason: 'inactive' };

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  if (row.usage_limit != null && row.used_count >= row.usage_limit) {
    return { valid: false, reason: 'usage_limit_reached' };
  }

  if (subtotalPence < row.min_subtotal_pence) {
    return { valid: false, reason: 'min_subtotal_not_met' };
  }

  const discountPence =
    row.discount_type === 'fixed'
      ? Math.min(row.value, subtotalPence) // never let a discount exceed the subtotal
      : Math.round((subtotalPence * row.value) / 100);

  // Belt-and-braces: a percent discount can't exceed 100% by schema, but
  // clamp anyway so a future data issue can never produce a negative charge.
  const cappedDiscountPence = Math.min(discountPence, subtotalPence);

  return { valid: true, discountPence: cappedDiscountPence, discountCodeId: row.id };
}

/**
 * Increments `used_count` by 1 for a discount code. Side-effecting — call
 * this exactly once per confirmed order, and ONLY after Stripe confirms the
 * PaymentIntent succeeded (see the webhook integration note above). Calling
 * this at checkout-creation time would incorrectly consume a limited-use
 * code's allowance for orders the customer never actually pays for.
 */
export async function incrementDiscountUsage(supabase: SupabaseClient, discountCodeId: string): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('discount_codes')
    .select('used_count')
    .eq('id', discountCodeId)
    .single();

  if (fetchError || !current) return;

  await supabase
    .from('discount_codes')
    .update({ used_count: (current as { used_count: number }).used_count + 1 })
    .eq('id', discountCodeId);
}

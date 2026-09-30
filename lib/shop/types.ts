// Shop-domain types (orders, product media, discounts, shipping) — kept
// separate from lib/booking/types.ts so the shop admin v2 build (Orders
// dashboard, media gallery, discount codes, shipping config) doesn't
// collide with booking-domain edits happening in parallel.

export type ShopOrderPaymentStatus = 'pending_payment' | 'paid' | 'cancelled';
export type ShopOrderFulfillmentStatus = 'unfulfilled' | 'fulfilled' | 'shipped' | 'delivered' | 'cancelled';

export type ShopOrderItem = {
  slug: string; // bundle_variant id — see app/api/shop/checkout/route.ts
  name: string;
  quantity: number;
  pricePence: number;
};

export type DbShopOrder = {
  id: string;
  stripe_payment_intent_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_postcode: string;
  shipping_country: string;
  items: ShopOrderItem[];
  /** Final charged amount: merchandise - discount_pence + shipping_pence. */
  subtotal_pence: number;
  discount_code_id: string | null;
  discount_pence: number;
  shipping_pence: number;
  status: ShopOrderPaymentStatus;
  /** Distinct from `status` (payment) — Shopify-style fulfillment tracking. */
  fulfillment_status: ShopOrderFulfillmentStatus;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  /** Internal admin-only notes, never shown to the customer. */
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** One image or short video attached to a bundle_variant's storefront gallery. */
export type BundleMediaType = 'image' | 'video';

export type DbBundleMedia = {
  id: string;
  bundle_variant_id: string;
  media_type: BundleMediaType;
  /** Path within the public `product-media` Supabase Storage bucket — resolve
   *  via `supabase.storage.from('product-media').getPublicUrl(storage_path)`. */
  storage_path: string;
  /** Videos only: a client-captured first-frame still, stored the same way,
   *  shown as the static cover until hover (desktop) or tap (mobile) plays
   *  the video. Null for images (the image itself is the cover). */
  poster_storage_path: string | null;
  sort_order: number;
  created_at: string;
};

export type DiscountType = 'percent' | 'fixed';

export type DbDiscountCode = {
  id: string;
  code: string;
  discount_type: DiscountType;
  /** percent: 1-100. fixed: pence. */
  value: number;
  active: boolean;
  /** Null = unlimited uses. */
  usage_limit: number | null;
  used_count: number;
  min_subtotal_pence: number;
  expires_at: string | null;
  created_at: string;
};

export type DbShippingSettings = {
  id: true;
  flat_rate_pence: number;
  /** Null = no free-shipping threshold offered. */
  free_shipping_threshold_pence: number | null;
  updated_at: string;
};

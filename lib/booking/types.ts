export type DbServiceCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
};

export type DbService = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  size: string | null;
  description: string;
  note: string | null;
  base_price_pence: number;
  hair_incl_price_pence: number | null;
  /** Appointment length, drives slot blocking. Null only for inactive services awaiting data. */
  service_time_mins: number | null;
  /** Appointment length when hair is included, only set when it differs from
   *  service_time_mins. Null falls back to service_time_mins — same
   *  convention hair_incl_price_pence uses against base_price_pence. See
   *  supabase/migrations/0008_acuity_reconciliation.sql. */
  hair_incl_service_time_mins: number | null;
  /** Customer-facing style longevity, e.g. "4-5" weeks — display only, never used in calculations. */
  style_duration_weeks: string | null;
  /** Packs of Xpression braiding hair required, e.g. "3-4" — display/stock-planning only. */
  xpression_packs: string | null;
  morning_only: boolean;
  included_bundle_count: number;
  included_bundle_inches: number | null;
  deposit_pence: number;
  active: boolean;
  sort_order: number;
};

/** A category-scoped add-on (e.g. "Luxe Freestyle", "Premium Slots").
 *  category_id is null for the virtual "Hair Included Styles" bucket —
 *  these apply whenever hairIncluded=true, regardless of the service's
 *  real base category, instead of that category's own (larger) list. */
export type DbServiceAddon = {
  id: string;
  category_id: string | null;
  name: string;
  price_delta_pence: number;
  duration_delta_mins: number;
  /** True only for "Premium Slots" — selecting it unlocks 06:00/20:00/21:00
   *  candidate start times in the availability engine. */
  unlocks_premium_slots: boolean;
  active: boolean;
  sort_order: number;
};

export type DbBundle = {
  id: string;
  name: string;
  active: boolean;
};

export type DbBundleVariant = {
  id: string;
  bundle_id: string;
  inches: number;
  colour: string;
  price_pence: number;
  /** Manual admin override — a variant is only ever actually purchasable
   *  (booking add-on or, once Agent E's shop reads this table, retail order)
   *  when in_stock is true AND stock_quantity > 0. */
  in_stock: boolean;
  /** Real inventory count backing the unified booking-add-on + retail /shop
   *  use of this table. */
  stock_quantity: number;
  /** Retail product photo for the unified /shop storefront. Null pre-launch. */
  image_url: string | null;
  /** Retail product copy for the unified /shop storefront. Null pre-launch. */
  description: string | null;
};

/**
 * pending_payment: 15-minute Stripe hold, unchanged.
 * confirmed: set ONLY by the Stripe webhook (payment_intent.succeeded /
 *   checkout.session.completed) in app/api/webhooks/stripe/route.ts — never
 *   by the frontend.
 * expired: the 15-minute hold lapsed unpaid. Distinct from `cancelled` (a
 *   customer- or admin-initiated cancellation) — set by
 *   app/api/cron/expire-bookings and the opportunistic inline cleanup in
 *   app/api/bookings/route.ts.
 * cancelled: explicit cancellation (customer self-service via
 *   /api/bookings/[id]/cancel, or admin).
 * completed / no_show: terminal, set by admin after the appointment.
 */
export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'expired'
  | 'no_show';

export type DbBooking = {
  id: string;
  booking_ref: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  /** Customer confirmed the hair-prep agreement at booking time. Always
   *  true for bookings created via the public POST /api/bookings route
   *  (enforced by its zod schema as z.literal(true)); not a DB-level hard
   *  constraint, so it may be false on an admin-created manual booking. */
  hair_prep_agreed: boolean;
  appointment_start: string;
  appointment_end: string;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  hair_included: boolean;
  service_price_pence: number;
  deposit_due_pence: number;
  deposit_paid_pence: number;
  total_price_pence: number;
  expires_at: string;
  /** Set once the 48h/24h reminder email has been sent — see
   *  lib/booking/reminders.ts. Null until sent. */
  reminder_48h_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  /** True for a booking created directly by admin (walk-in/phone), which
   *  skips the Stripe hold/webhook flow entirely and goes straight to
   *  'confirmed'. False for the normal customer self-service flow. */
  created_by_admin: boolean;
  payment_method: 'stripe' | 'cash' | 'other';
  created_at: string;
  updated_at: string;
};

/** Admin-managed per-date exception to the default hourly slot grid — see
 *  lib/booking/availability.ts and supabase/migrations/0007_*.sql. */
export type SlotOverrideAction = 'open' | 'blocked';

export type DbSlotOverride = {
  id: string;
  /** YYYY-MM-DD, Europe/London calendar date. */
  date: string;
  /** HH:mm[:ss] local Europe/London time. */
  start_time: string;
  action: SlotOverrideAction;
  created_at: string;
};

export type DbBookingBundle = {
  id: string;
  booking_id: string;
  bundle_variant_id: string;
  quantity: number;
  price_pence_at_booking: number;
};

export type DbBookingAddon = {
  id: string;
  booking_id: string;
  service_addon_id: string | null;
  name_at_booking: string;
  price_delta_pence_at_booking: number;
  duration_delta_mins_at_booking: number;
};

export type TimeSlot = {
  /** ISO 8601 UTC start time */
  start: string;
  /** ISO 8601 UTC end time */
  end: string;
  /** Human-readable local time, e.g. "10:30am" */
  label: string;
};

export type AvailableDayMap = Record<string, boolean>;

export type BundleLinePayload = {
  bundleVariantId: string;
  quantity: number;
};

export type CreateBookingPayload = {
  serviceId: string;
  hairIncluded: boolean;
  addOnIds: string[];
  bundleLines: BundleLinePayload[];
  date: string; // YYYY-MM-DD (Europe/London local date)
  slotStart: string; // ISO 8601 UTC, must match a slot returned by /api/availability/slots
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
  /** Must be true — the public booking route rejects the request otherwise. */
  hairPrepAgreed: boolean;
};

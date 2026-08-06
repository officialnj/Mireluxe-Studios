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
  in_stock: boolean;
};

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export type DbBooking = {
  id: string;
  booking_ref: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
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
  created_at: string;
  updated_at: string;
};

export type DbBookingBundle = {
  id: string;
  booking_id: string;
  bundle_variant_id: string;
  quantity: number;
  price_pence_at_booking: number;
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
  bundleLines: BundleLinePayload[];
  date: string; // YYYY-MM-DD (Europe/London local date)
  slotStart: string; // ISO 8601 UTC, must match a slot returned by /api/availability/slots
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
};

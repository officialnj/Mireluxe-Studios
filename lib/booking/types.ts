export type DbService = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  note: string | null;
  hair_included: boolean;
  price_from_pence: number;
  duration_mins: number;
  deposit_pence: number;
  active: boolean;
  sort_order: number;
};

export type DbBundle = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  active: boolean;
};

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export type DbBooking = {
  id: string;
  booking_ref: string;
  service_id: string;
  bundle_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  appointment_start: string;
  appointment_end: string;
  status: BookingStatus;
  stripe_payment_intent_id: string | null;
  service_price_pence: number;
  bundle_price_pence: number;
  deposit_due_pence: number;
  deposit_paid_pence: number;
  total_price_pence: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
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

export type CreateBookingPayload = {
  serviceId: string;
  bundleId: string | null;
  date: string; // YYYY-MM-DD (Europe/London local date)
  slotStart: string; // ISO 8601 UTC, must match a slot returned by /api/availability/slots
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string | null;
};

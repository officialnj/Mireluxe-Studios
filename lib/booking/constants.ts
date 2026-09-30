export const STUDIO_TIMEZONE = 'Europe/London';
export const BOOKING_HOLD_MINUTES = 15;

// No longer used by lib/booking/availability.ts default slot generation,
// which now generates a fixed hourly grid (see DEFAULT_SLOT_START_HOUR /
// DEFAULT_SLOT_END_HOUR below) instead of stepping every N minutes across
// studio_hours open/close. Kept — not read anywhere else in the codebase as
// of this change, so it's a deletion candidate rather than something to
// silently repurpose.
export const SLOT_INTERVAL_MINUTES = 30;

// Default bookable start times run hourly from 08:00 up to and including
// 16:00 (the LAST valid start time — a slot may not start after 16:00).
// This is independent of the per-weekday studio_hours open/close columns,
// which now only gate whether a day is open at all (is_closed), not the
// width of the bookable window. Admin-managed `slot_overrides` rows are
// additive on top of this grid — see getReleasedWindow/candidateSlotsForDay.
export const DEFAULT_SLOT_START_HOUR = 8;
export const DEFAULT_SLOT_END_HOUR = 16;

// A slot starting less than this many minutes from now must never be
// offered or bookable, even if otherwise free.
export const MIN_BOOKING_NOTICE_MINUTES = 120;

// Booking window: on the 20th of the month at 00:00 Europe/London, the
// entirety of the NEXT calendar month opens for booking. Before the 20th,
// customers can only book up to the end of the CURRENT calendar month. This
// replaced the previous rolling `booking_settings.advance_booking_days`
// window — see getReleasedWindow in lib/booking/availability.ts.
export const RELEASE_DAY_OF_MONTH = 20;

// Self-service reschedule/cancel (capability-token links under
// /api/bookings/[id]/reschedule and /cancel) are blocked within this many
// minutes of the appointment start, server-enforced.
export const SELF_SERVICE_CUTOFF_MINUTES = 48 * 60;

// TODO: confirm exact cancellation window/fee with Miracle — placeholder
// only, referenced by the About page FAQ and booking checkout copy.
export const CANCELLATION_POLICY_PLACEHOLDER =
  'Cancellations made at least 48 hours before your appointment are eligible for a full refund of your deposit. ' +
  'Cancellations within 48 hours, or no-shows, forfeit the deposit. To cancel or reschedule, contact the studio directly.';

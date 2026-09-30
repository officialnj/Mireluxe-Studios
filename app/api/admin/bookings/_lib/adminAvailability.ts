import type { SupabaseClient } from '@supabase/supabase-js';
import { addMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_SLOT_END_HOUR, DEFAULT_SLOT_START_HOUR, STUDIO_TIMEZONE } from '@/lib/booking/constants';
import type { DbService, SlotOverrideAction, TimeSlot } from '@/lib/booking/types';

/**
 * Admin-only slot computation for manually creating a walk-in/phone booking
 * from the dashboard (CreateBookingModal). Deliberately a separate,
 * self-contained module rather than an extension of
 * lib/booking/availability.ts: this agent's ownership is scoped to
 * app/api/admin/bookings/* only, so lib/booking/* is off-limits to edit.
 *
 * Mirrors candidateSlotsForDay() in lib/booking/availability.ts (same
 * default hourly grid, studio_hours/blocked_dates/slot_overrides handling,
 * and overlap check against active bookings) with two deliberate
 * differences, both because an admin creating a booking in person/by phone
 * is not the customer-facing flow:
 *   1. No MIN_BOOKING_NOTICE_MINUTES (2-hour) cutoff — admin can book same-day,
 *      immediately.
 *   2. No getReleasedWindow() month-release restriction — admin can book any
 *      future date, not just the currently-released window.
 * Studio hours / blocked dates / slot overrides / morning_only are still
 * respected (real operational constraints, not customer-protection rules),
 * and the actual double-booking guarantee is always the DB's
 * no_overlapping_bookings exclusion constraint on insert regardless of what
 * this function computes — this is only the candidate list shown in the UI.
 */

type StudioHoursRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

type BlockedDateRow = {
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
};

type SlotOverrideRow = {
  date: string;
  start_time: string;
  action: SlotOverrideAction;
};

type BookingRangeRow = {
  appointment_start: string;
  appointment_end: string;
};

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

async function fetchService(supabase: SupabaseClient, serviceId: string): Promise<DbService | null> {
  const { data, error } = await supabase.from('services').select('*').eq('id', serviceId).eq('active', true).single();
  if (error || !data) return null;
  return data as DbService;
}

async function fetchStudioHours(supabase: SupabaseClient): Promise<Map<number, StudioHoursRow>> {
  const { data, error } = await supabase.from('studio_hours').select('*');
  if (error || !data) return new Map();
  return new Map((data as StudioHoursRow[]).map((row) => [row.day_of_week, row]));
}

async function fetchBookingBufferMinutes(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('booking_settings').select('buffer_minutes').eq('id', true).single();
  if (error || !data) return 0;
  return (data as { buffer_minutes: number }).buffer_minutes ?? 0;
}

async function fetchBlockedDates(supabase: SupabaseClient, dateStr: string): Promise<BlockedDateRow[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('blocked_date, start_time, end_time')
    .eq('blocked_date', dateStr);
  if (error || !data) return [];
  return data as BlockedDateRow[];
}

async function fetchSlotOverrides(supabase: SupabaseClient, dateStr: string): Promise<SlotOverrideRow[]> {
  const { data, error } = await supabase.from('slot_overrides').select('date, start_time, action').eq('date', dateStr);
  if (error || !data) return [];
  return data as SlotOverrideRow[];
}

async function fetchActiveBookings(
  supabase: SupabaseClient,
  fromUtcIso: string,
  throughUtcIso: string
): Promise<BookingRangeRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select('appointment_start, appointment_end')
    .lt('appointment_start', throughUtcIso)
    .gt('appointment_end', fromUtcIso)
    .or(`status.eq.confirmed,and(status.eq.pending_payment,expires_at.gt.${nowIso})`);
  if (error || !data) return [];
  return data as BookingRangeRow[];
}

function overlapsAny(start: Date, end: Date, ranges: Array<{ start: Date; end: Date }>): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

function buildSlot(startUtc: Date, durationMins: number): TimeSlot {
  const endUtc = addMinutes(startUtc, durationMins);
  return {
    start: startUtc.toISOString(),
    end: endUtc.toISOString(),
    label: formatInTimeZone(startUtc, STUDIO_TIMEZONE, 'h:mmaaa'),
  };
}

function generateDefaultCandidates(dateStr: string, durationMins: number, morningOnly: boolean): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = DEFAULT_SLOT_START_HOUR; hour <= DEFAULT_SLOT_END_HOUR; hour++) {
    const hh = String(hour).padStart(2, '0');
    if (morningOnly && `${hh}:00` >= '12:00') continue;
    const startUtc = fromZonedTime(`${dateStr}T${hh}:00`, STUDIO_TIMEZONE);
    slots.push(buildSlot(startUtc, durationMins));
  }
  return slots;
}

function generateOverrideCandidate(dateStr: string, startTime: string, durationMins: number): TimeSlot {
  const startUtc = fromZonedTime(`${dateStr}T${startTime}`, STUDIO_TIMEZONE);
  return buildSlot(startUtc, durationMins);
}

function blockedRangesForDay(
  dateStr: string,
  blocked: BlockedDateRow[]
): { wholeDay: boolean; ranges: Array<{ start: Date; end: Date }> } {
  const dayBlocks = blocked.filter((b) => b.blocked_date === dateStr);
  const wholeDay = dayBlocks.some((b) => !b.start_time || !b.end_time);
  if (wholeDay) return { wholeDay: true, ranges: [] };

  const ranges = dayBlocks.map((b) => ({
    start: fromZonedTime(`${dateStr}T${b.start_time}`, STUDIO_TIMEZONE),
    end: fromZonedTime(`${dateStr}T${b.end_time}`, STUDIO_TIMEZONE),
  }));
  return { wholeDay: false, ranges };
}

export async function getAdminDayAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  dateStr: string // YYYY-MM-DD, Europe/London calendar date
): Promise<{ slots: TimeSlot[]; service: DbService | null }> {
  const service = await fetchService(supabase, serviceId);
  if (!service || service.service_time_mins == null) return { slots: [], service };

  const hoursByWeekday = await fetchStudioHours(supabase);
  const blocked = await fetchBlockedDates(supabase, dateStr);
  const overrides = await fetchSlotOverrides(supabase, dateStr);
  const bufferMinutes = await fetchBookingBufferMinutes(supabase);

  const hours = hoursByWeekday.get(weekdayOf(dateStr));
  const dayIsOpen = !!hours && !hours.is_closed && !!hours.open_time && !!hours.close_time;

  const dayOverrides = overrides.filter((o) => o.date === dateStr);
  const blockedStartTimes = new Set(dayOverrides.filter((o) => o.action === 'blocked').map((o) => normalizeTime(o.start_time)));
  const openOverrideStartTimes = dayOverrides.filter((o) => o.action === 'open').map((o) => normalizeTime(o.start_time));

  const defaultCandidates = dayIsOpen
    ? generateDefaultCandidates(dateStr, service.service_time_mins, service.morning_only).filter(
        (slot) => !blockedStartTimes.has(formatInTimeZone(new Date(slot.start), STUDIO_TIMEZONE, 'HH:mm'))
      )
    : [];

  const overrideCandidates = openOverrideStartTimes.map((t) =>
    generateOverrideCandidate(dateStr, t, service.service_time_mins as number)
  );

  const seenStarts = new Set<string>();
  const candidates = [...defaultCandidates, ...overrideCandidates].filter((slot) => {
    if (seenStarts.has(slot.start)) return false;
    seenStarts.add(slot.start);
    return true;
  });
  if (candidates.length === 0) return { slots: [], service };

  const dayStartUtc = candidates.reduce((min, c) => (c.start < min ? c.start : min), candidates[0].start);
  const dayEndUtc = candidates.reduce((max, c) => (c.end > max ? c.end : max), candidates[0].end);
  const bookings = await fetchActiveBookings(supabase, dayStartUtc, dayEndUtc);
  const bookingRanges = bookings.map((b) => ({
    start: new Date(b.appointment_start),
    end: addMinutes(new Date(b.appointment_end), bufferMinutes),
  }));

  const { wholeDay, ranges: blockedRanges } = blockedRangesForDay(dateStr, blocked);
  const overrideStartSet = new Set(overrideCandidates.map((c) => c.start));

  // Deliberately no MIN_BOOKING_NOTICE_MINUTES / getReleasedWindow check here
  // — see module doc comment above. Everything else (open/closed day,
  // blocked dates, slot overrides, active-booking overlap) still applies.
  // Still exclude slots that have already started — an admin can book
  // "right now", not literally in the past.
  const now = new Date();
  const slots = candidates
    .filter((slot) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);

      if (start < now) return false;
      if (overlapsAny(start, end, bookingRanges)) return false;

      const isAdminOverride = overrideStartSet.has(slot.start);
      if (!isAdminOverride) {
        if (wholeDay) return false;
        if (overlapsAny(start, end, blockedRanges)) return false;
      }

      return true;
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  return { slots, service };
}

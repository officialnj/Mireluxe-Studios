import type { SupabaseClient } from '@supabase/supabase-js';
import { addMinutes, addMonths, endOfMonth, format, getDate } from 'date-fns';
import { fromZonedTime, formatInTimeZone, toZonedTime } from 'date-fns-tz';
import {
  DEFAULT_SLOT_END_HOUR,
  DEFAULT_SLOT_START_HOUR,
  MIN_BOOKING_NOTICE_MINUTES,
  RELEASE_DAY_OF_MONTH,
  STUDIO_TIMEZONE,
} from './constants';
import type { AvailableDayMap, DbService, SlotOverrideAction, TimeSlot } from './types';

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

type BookingSettingsRow = {
  buffer_minutes: number;
  // advance_booking_days intentionally unread — see getReleasedWindow.
  advance_booking_days: number;
};

/**
 * Dates below are always treated as Europe/London calendar dates
 * (YYYY-MM-DD), independent of the server's runtime timezone. Any Date
 * object produced via `toZonedTime` here is only ever read back through
 * date-fns's local getters/format (never the getUTC family or toISOString)
 * — that pairing is what keeps it internally consistent regardless of
 * server timezone.
 */

/**
 * Booking window: on the 20th of each month at 00:00 Europe/London, the
 * entirety of the NEXT calendar month opens for booking. Before the 20th,
 * customers can only book up to the end of the CURRENT calendar month. This
 * is expressed as a single upper bound (`through`) because next month
 * opening is additive on top of the remainder of the current month, not a
 * replacement of it — `through` naturally covers both.
 *
 * Replaces the previous rolling `booking_settings.advance_booking_days`
 * window. That column is intentionally left unread (not dropped, per the
 * deletion lock) — see the deletion-candidates note in the PR description.
 */
export function getReleasedWindow(now: Date = new Date()): { from: string; through: string } {
  const londonNow = toZonedTime(now, STUDIO_TIMEZONE);
  const from = format(londonNow, 'yyyy-MM-dd');
  const throughAnchor = getDate(londonNow) >= RELEASE_DAY_OF_MONTH ? addMonths(londonNow, 1) : londonNow;
  const through = format(endOfMonth(throughAnchor), 'yyyy-MM-dd');
  return { from, through };
}

function weekdayOf(dateStr: string): number {
  // Construct a UTC midnight Date for the calendar date and read it back
  // with getUTCDay() — correct regardless of server timezone.
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function normalizeTime(t: string): string {
  return t.slice(0, 5); // "HH:MM:SS" (or "HH:MM") -> "HH:MM"
}

async function fetchService(supabase: SupabaseClient, serviceId: string): Promise<DbService | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('active', true)
    .single();
  if (error || !data) return null;
  return data as DbService;
}

async function fetchStudioHours(supabase: SupabaseClient): Promise<Map<number, StudioHoursRow>> {
  const { data, error } = await supabase.from('studio_hours').select('*');
  if (error || !data) return new Map();
  return new Map((data as StudioHoursRow[]).map((row) => [row.day_of_week, row]));
}

async function fetchBookingSettings(supabase: SupabaseClient): Promise<BookingSettingsRow> {
  const { data, error } = await supabase.from('booking_settings').select('*').eq('id', true).single();
  if (error || !data) return { buffer_minutes: 0, advance_booking_days: 60 };
  return data as BookingSettingsRow;
}

async function fetchBlockedDates(
  supabase: SupabaseClient,
  fromStr: string,
  throughStr: string
): Promise<BlockedDateRow[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('blocked_date, start_time, end_time')
    .gte('blocked_date', fromStr)
    .lte('blocked_date', throughStr);
  if (error || !data) return [];
  return data as BlockedDateRow[];
}

async function fetchSlotOverrides(
  supabase: SupabaseClient,
  fromStr: string,
  throughStr: string
): Promise<SlotOverrideRow[]> {
  const { data, error } = await supabase
    .from('slot_overrides')
    .select('date, start_time, action')
    .gte('date', fromStr)
    .lte('date', throughStr);
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

/**
 * Default hourly grid: 08:00, 09:00, ..., 16:00 (16:00 is the last valid
 * start time). Independent of studio_hours open/close — those columns now
 * only gate whether the day is open at all (is_closed), not the width of
 * the bookable window.
 */
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

/** An admin-added `slot_overrides` (action='open') start time for this date. */
function generateOverrideCandidate(dateStr: string, startTime: string, durationMins: number): TimeSlot {
  const startUtc = fromZonedTime(`${dateStr}T${startTime}`, STUDIO_TIMEZONE);
  return buildSlot(startUtc, durationMins);
}

function blockedRangesForDay(dateStr: string, blocked: BlockedDateRow[]): { wholeDay: boolean; ranges: Array<{ start: Date; end: Date }> } {
  const dayBlocks = blocked.filter((b) => b.blocked_date === dateStr);
  const wholeDay = dayBlocks.some((b) => !b.start_time || !b.end_time);
  if (wholeDay) return { wholeDay: true, ranges: [] };

  const ranges = dayBlocks.map((b) => ({
    start: fromZonedTime(`${dateStr}T${b.start_time}`, STUDIO_TIMEZONE),
    end: fromZonedTime(`${dateStr}T${b.end_time}`, STUDIO_TIMEZONE),
  }));
  return { wholeDay: false, ranges };
}

async function candidateSlotsForDay(
  supabase: SupabaseClient,
  service: DbService,
  dateStr: string,
  hoursByWeekday: Map<number, StudioHoursRow>,
  blocked: BlockedDateRow[],
  overrides: SlotOverrideRow[],
  bufferMinutes: number
): Promise<TimeSlot[]> {
  if (service.service_time_mins == null) return [];

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

  // Admin-added `open` overrides bypass the default hourly grid, the
  // morning_only restriction, and the studio_hours is_closed/blocked_dates
  // whole-day checks below — they're an explicit, date-specific exception.
  // They are NOT exempt from real booking conflicts (still filtered against
  // fetchActiveBookings, and ultimately backstopped by the DB's
  // no_overlapping_bookings exclusion constraint on insert) or the 2-hour
  // minimum-notice rule, since both apply to the public-facing slot list
  // this function produces.
  const overrideCandidates = openOverrideStartTimes.map((t) => generateOverrideCandidate(dateStr, t, service.service_time_mins as number));

  const seenStarts = new Set<string>();
  const candidates = [...defaultCandidates, ...overrideCandidates].filter((slot) => {
    if (seenStarts.has(slot.start)) return false;
    seenStarts.add(slot.start);
    return true;
  });
  if (candidates.length === 0) return [];

  const dayStartUtc = candidates.reduce((min, c) => (c.start < min ? c.start : min), candidates[0].start);
  const dayEndUtc = candidates.reduce((max, c) => (c.end > max ? c.end : max), candidates[0].end);
  const bookings = await fetchActiveBookings(supabase, dayStartUtc, dayEndUtc);
  const bookingRanges = bookings.map((b) => ({
    start: new Date(b.appointment_start),
    end: addMinutes(new Date(b.appointment_end), bufferMinutes),
  }));

  const { wholeDay, ranges: blockedRanges } = blockedRangesForDay(dateStr, blocked);
  const overrideStartSet = new Set(overrideCandidates.map((c) => c.start));

  const minStartUtc = addMinutes(new Date(), MIN_BOOKING_NOTICE_MINUTES);

  return candidates
    .filter((slot) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);

      // Never past slots, and never inside the 2-hour minimum notice window.
      if (start < minStartUtc) return false;

      // Never a slot that overlaps an already-booked or currently-held
      // (pending, non-expired) appointment, regardless of source.
      if (overlapsAny(start, end, bookingRanges)) return false;

      const isAdminOverride = overrideStartSet.has(slot.start);
      if (!isAdminOverride) {
        if (wholeDay) return false;
        if (overlapsAny(start, end, blockedRanges)) return false;
      }

      return true;
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export async function getMonthAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  monthStr: string // YYYY-MM
): Promise<AvailableDayMap> {
  const service = await fetchService(supabase, serviceId);
  if (!service) return {};

  const settings = await fetchBookingSettings(supabase);
  const window = getReleasedWindow();
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const hoursByWeekday = await fetchStudioHours(supabase);
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
  const blocked = await fetchBlockedDates(supabase, monthStart, monthEnd);
  const overrides = await fetchSlotOverrides(supabase, monthStart, monthEnd);

  const result: AvailableDayMap = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    if (dateStr < window.from || dateStr > window.through) {
      result[dateStr] = false;
      continue;
    }
    const slots = await candidateSlotsForDay(supabase, service, dateStr, hoursByWeekday, blocked, overrides, settings.buffer_minutes);
    result[dateStr] = slots.length > 0;
  }

  return result;
}

export async function getDayAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  dateStr: string // YYYY-MM-DD
): Promise<{ slots: TimeSlot[]; fullyBooked: boolean; service: DbService | null }> {
  const service = await fetchService(supabase, serviceId);
  if (!service) return { slots: [], fullyBooked: false, service: null };

  const settings = await fetchBookingSettings(supabase);
  const window = getReleasedWindow();
  if (dateStr < window.from || dateStr > window.through) {
    return { slots: [], fullyBooked: false, service };
  }

  const hoursByWeekday = await fetchStudioHours(supabase);
  const blocked = await fetchBlockedDates(supabase, dateStr, dateStr);
  const overrides = await fetchSlotOverrides(supabase, dateStr, dateStr);
  const hours = hoursByWeekday.get(weekdayOf(dateStr));

  const wasOpenDay = !!hours && !hours.is_closed && !!hours.open_time && !!hours.close_time;
  const slots = await candidateSlotsForDay(supabase, service, dateStr, hoursByWeekday, blocked, overrides, settings.buffer_minutes);

  return { slots, fullyBooked: wasOpenDay && slots.length === 0, service };
}

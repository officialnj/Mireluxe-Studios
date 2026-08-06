import type { SupabaseClient } from '@supabase/supabase-js';
import { addMinutes, addMonths, endOfMonth, format, isAfter, parseISO } from 'date-fns';
import { fromZonedTime, formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { SLOT_INTERVAL_MINUTES, SLOT_RELEASE_DAY, STUDIO_TIMEZONE } from './constants';
import type { AvailableDayMap, DbService, TimeSlot } from './types';

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

type BookingRangeRow = {
  appointment_start: string;
  appointment_end: string;
};

/**
 * Dates below are always treated as Europe/London calendar dates
 * (YYYY-MM-DD), independent of the server's runtime timezone. Any Date
 * object produced via `toZonedTime` here is only ever read back through
 * date-fns's local getters/format (never the getUTC family or toISOString)
 * — that pairing is what keeps it internally consistent regardless of
 * server timezone.
 */

export function getReleasedWindow(now: Date = new Date()): { from: string; through: string } {
  const londonNow = toZonedTime(now, STUDIO_TIMEZONE);
  const from = format(londonNow, 'yyyy-MM-dd');
  const releaseMonthAnchor = londonNow.getDate() >= SLOT_RELEASE_DAY ? addMonths(londonNow, 1) : londonNow;
  const through = format(endOfMonth(releaseMonthAnchor), 'yyyy-MM-dd');
  return { from, through };
}

function weekdayOf(dateStr: string): number {
  // parseISO on a date-only string yields UTC midnight, so getUTCDay() gives
  // the correct calendar weekday regardless of server timezone.
  return parseISO(dateStr).getUTCDay();
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

function generateCandidateSlots(
  dateStr: string,
  openTime: string,
  closeTime: string,
  durationMins: number
): TimeSlot[] {
  const closeUtc = fromZonedTime(`${dateStr}T${closeTime}`, STUDIO_TIMEZONE);
  let cursorUtc = fromZonedTime(`${dateStr}T${openTime}`, STUDIO_TIMEZONE);
  const slots: TimeSlot[] = [];

  while (true) {
    const slotEndUtc = addMinutes(cursorUtc, durationMins);
    if (isAfter(slotEndUtc, closeUtc)) break;
    slots.push({
      start: cursorUtc.toISOString(),
      end: slotEndUtc.toISOString(),
      label: formatInTimeZone(cursorUtc, STUDIO_TIMEZONE, 'h:mmaaa'),
    });
    cursorUtc = addMinutes(cursorUtc, SLOT_INTERVAL_MINUTES);
  }

  return slots;
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
  blocked: BlockedDateRow[]
): Promise<TimeSlot[]> {
  const hours = hoursByWeekday.get(weekdayOf(dateStr));
  if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return [];

  const { wholeDay, ranges: blockedRanges } = blockedRangesForDay(dateStr, blocked);
  if (wholeDay) return [];

  const candidates = generateCandidateSlots(dateStr, hours.open_time, hours.close_time, service.duration_mins);
  if (candidates.length === 0) return [];

  const dayStartUtc = candidates[0].start;
  const dayEndUtc = candidates[candidates.length - 1].end;
  const bookings = await fetchActiveBookings(supabase, dayStartUtc, dayEndUtc);
  const bookingRanges = bookings.map((b) => ({ start: new Date(b.appointment_start), end: new Date(b.appointment_end) }));

  return candidates.filter((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    return !overlapsAny(start, end, bookingRanges) && !overlapsAny(start, end, blockedRanges);
  });
}

export async function getMonthAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  monthStr: string // YYYY-MM
): Promise<AvailableDayMap> {
  const service = await fetchService(supabase, serviceId);
  if (!service) return {};

  const window = getReleasedWindow();
  const [year, month] = monthStr.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const hoursByWeekday = await fetchStudioHours(supabase);
  const blocked = await fetchBlockedDates(supabase, `${monthStr}-01`, format(endOfMonth(monthStart), 'yyyy-MM-dd'));

  const result: AvailableDayMap = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    if (dateStr < window.from || dateStr > window.through) {
      result[dateStr] = false;
      continue;
    }
    const slots = await candidateSlotsForDay(supabase, service, dateStr, hoursByWeekday, blocked);
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

  const window = getReleasedWindow();
  if (dateStr < window.from || dateStr > window.through) {
    return { slots: [], fullyBooked: false, service };
  }

  const hoursByWeekday = await fetchStudioHours(supabase);
  const blocked = await fetchBlockedDates(supabase, dateStr, dateStr);
  const hours = hoursByWeekday.get(weekdayOf(dateStr));

  const wasOpenDay = !!hours && !hours.is_closed && !!hours.open_time && !!hours.close_time;
  const slots = await candidateSlotsForDay(supabase, service, dateStr, hoursByWeekday, blocked);

  return { slots, fullyBooked: wasOpenDay && slots.length === 0, service };
}

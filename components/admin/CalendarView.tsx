'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { statusStyle, LEGEND_STATUSES, BOOKING_STATUS } from '@/lib/admin/bookingStatus';
import CreateBookingModal from '@/components/admin/CreateBookingModal';
import BookingDetailsPanel from '@/components/admin/BookingDetailsPanel';
import type { BookingRow } from '@/components/admin/BookingsTable';

type ViewMode = 'day' | 'week' | 'month';

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const HOUR_PX = 56;

// London-local hour/minute of an instant.
function lh(iso: string) {
  return Number(formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'H'));
}
function lm(iso: string) {
  return Number(formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'm'));
}
function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}
function londonDayKey(iso: string) {
  return formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'yyyy-MM-dd');
}

function rangeFor(view: ViewMode, anchor: Date) {
  if (view === 'month') return { from: dayKey(startOfMonth(anchor)), through: dayKey(endOfMonth(anchor)) };
  if (view === 'week') {
    return { from: dayKey(startOfWeek(anchor, { weekStartsOn: 1 })), through: dayKey(endOfWeek(anchor, { weekStartsOn: 1 })) };
  }
  return { from: dayKey(anchor), through: dayKey(anchor) };
}

/** Simple lane packer so overlapping appointments sit side-by-side instead of
 *  hiding each other (rare for a solo studio, but handled). */
function packLanes(items: BookingRow[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.appointment_start.localeCompare(b.appointment_start));
  const laneEnds: string[] = [];
  const placement = new Map<string, number>();
  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => end <= b.appointment_start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.appointment_end);
    } else {
      laneEnds[lane] = b.appointment_end;
    }
    placement.set(b.id, lane);
  }
  const lanes = Math.max(1, laneEnds.length);
  const result = new Map<string, { lane: number; lanes: number }>();
  for (const b of sorted) result.set(b.id, { lane: placement.get(b.id) ?? 0, lanes });
  return result;
}

export default function CalendarView() {
  const [view, setView] = useState<ViewMode>('day');
  const [anchor, setAnchor] = useState(new Date());
  const [pickerMonth, setPickerMonth] = useState(new Date());
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { from, through } = rangeFor(view, anchor);
    const res = await fetch(`/api/admin/bookings?from=${from}&through=${through}`);
    setLoading(false);
    if (!res.ok) {
      setError('Failed to load bookings.');
      return;
    }
    const data = await res.json();
    setBookings(data.bookings ?? []);
  }, [view, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const h = () => load();
    window.addEventListener('admin-bookings-changed', h);
    return () => window.removeEventListener('admin-bookings-changed', h);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.customer_phone.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const byDate = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    for (const b of filtered) {
      const k = londonDayKey(b.appointment_start);
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [filtered]);

  // Grid hour bounds expand to fit any appointment outside the default window.
  const [startHour, endHour] = useMemo(() => {
    let s = DEFAULT_START_HOUR;
    let e = DEFAULT_END_HOUR;
    for (const b of filtered) {
      s = Math.min(s, lh(b.appointment_start));
      const eh = lh(b.appointment_end) + (lm(b.appointment_end) > 0 ? 1 : 0);
      e = Math.max(e, eh);
    }
    return [Math.max(0, s), Math.min(24, e)];
  }, [filtered]);

  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => startHour + i), [startHour, endHour]);

  function go(dir: -1 | 1) {
    setAnchor((a) => (view === 'month' ? addMonths(a, dir) : addDays(a, view === 'week' ? dir * 7 : dir)));
  }
  function goToday() {
    setAnchor(new Date());
    setPickerMonth(new Date());
  }

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }),
    [anchor]
  );
  const gridDays = view === 'day' ? [anchor] : weekDays;

  const dateLabel =
    view === 'month'
      ? format(anchor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM yyyy')}`
        : format(anchor, 'EEE, d MMM yyyy');

  return (
    <div className="xl:grid xl:grid-cols-[272px_1fr] xl:gap-6">
      {/* ── Left panel (xl+) ── */}
      <aside className="mb-6 hidden xl:block">
        <MiniCalendar
          month={pickerMonth}
          anchor={anchor}
          onPrev={() => setPickerMonth(subMonths(pickerMonth, 1))}
          onNext={() => setPickerMonth(addMonths(pickerMonth, 1))}
          onPick={(d) => {
            setAnchor(d);
            if (view === 'month') setView('day');
          }}
        />
        <div className="mt-6">
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-luxe text-charcoal/45">Quick navigation</p>
          <div className="space-y-1 text-sm">
            <button onClick={goToday} className="block w-full rounded-lg px-3 py-2 text-left text-charcoal/70 hover:bg-charcoal/[0.04]">Today</button>
            <button onClick={() => { setView('week'); goToday(); }} className="block w-full rounded-lg px-3 py-2 text-left text-charcoal/70 hover:bg-charcoal/[0.04]">This week</button>
            <button onClick={() => { setView('month'); goToday(); }} className="block w-full rounded-lg px-3 py-2 text-left text-charcoal/70 hover:bg-charcoal/[0.04]">This month</button>
          </div>
        </div>
        <Legend />
      </aside>

      {/* ── Main ── */}
      <div className="min-w-0">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-charcoal/10 bg-white p-1 text-xs">
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 capitalize transition-colors ${view === v ? 'bg-gold text-charcoal' : 'text-charcoal/60 hover:text-charcoal'}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/10 bg-white text-charcoal/60 hover:text-gold">‹</button>
            <button onClick={goToday} className="rounded-full border border-charcoal/10 bg-white px-3 py-1.5 text-xs text-charcoal/70 hover:text-gold">Today</button>
            <button onClick={() => go(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/10 bg-white text-charcoal/60 hover:text-gold">›</button>
          </div>
          <span className="font-serif text-lg font-light">{dateLabel}</span>
          {/* Native date jump — primary date control on mobile (no left panel). */}
          <label className="relative inline-flex cursor-pointer items-center xl:hidden">
            <input
              type="date"
              value={dayKey(anchor)}
              onChange={(e) => e.target.value && setAnchor(new Date(`${e.target.value}T00:00:00`))}
              className="h-8 w-8 cursor-pointer rounded-full border border-charcoal/10 bg-white text-[0px] [color-scheme:light]"
              aria-label="Jump to date"
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              className="hidden w-44 rounded-full border border-charcoal/15 bg-white px-3.5 py-1.5 text-sm outline-none focus:border-gold sm:block"
            />
            <CreateBookingModal />
          </div>
        </div>

        {/* Mobile search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="mb-4 w-full rounded-full border border-charcoal/15 bg-white px-3.5 py-2 text-sm outline-none focus:border-gold sm:hidden"
        />

        {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mb-3 text-xs text-charcoal/40">Loading…</p>}

        {/* Legend (mobile / < xl) */}
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 xl:hidden">
          {LEGEND_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[0.7rem] text-charcoal/55">
              <span className={`h-2.5 w-2.5 rounded-full ${BOOKING_STATUS[s].dot}`} /> {BOOKING_STATUS[s].label}
            </span>
          ))}
        </div>

        {view === 'month' ? (
          <MonthGrid anchor={anchor} byDate={byDate} onPickDay={(d) => { setAnchor(d); setView('day'); }} onSelect={setSelected} />
        ) : (
          <TimeGrid days={gridDays} hours={hours} startHour={startHour} byDate={byDate} now={now} onSelect={setSelected} singleDay={view === 'day'} />
        )}
      </div>

      {selected && (
        <BookingDetailsPanel
          booking={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6">
      <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-luxe text-charcoal/45">Booking status</p>
      <div className="space-y-1.5">
        {LEGEND_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-2 text-xs text-charcoal/60">
            <span className={`h-2.5 w-2.5 rounded-full ${BOOKING_STATUS[s].dot}`} /> {BOOKING_STATUS[s].label}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCalendar({
  month,
  anchor,
  onPrev,
  onNext,
  onPick,
}: {
  month: Date;
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onPick: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-serif text-sm">{format(month, 'MMMM yyyy')}</span>
        <div className="flex gap-1">
          <button onClick={onPrev} aria-label="Previous month" className="flex h-6 w-6 items-center justify-center rounded-full text-charcoal/50 hover:bg-charcoal/[0.06]">‹</button>
          <button onClick={onNext} aria-label="Next month" className="flex h-6 w-6 items-center justify-center rounded-full text-charcoal/50 hover:bg-charcoal/[0.06]">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.6rem] text-charcoal/40">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const selected = isSameDay(d, anchor);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className={`flex h-8 items-center justify-center rounded-full text-xs transition-colors ${
                selected ? 'bg-gold text-charcoal' : isToday(d) ? 'text-gold' : isSameMonth(d, month) ? 'text-charcoal/70 hover:bg-charcoal/[0.06]' : 'text-charcoal/25 hover:bg-charcoal/[0.04]'
              }`}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  hours,
  startHour,
  byDate,
  now,
  onSelect,
  singleDay,
}: {
  days: Date[];
  hours: number[];
  startHour: number;
  byDate: Map<string, BookingRow[]>;
  now: Date | null;
  onSelect: (b: BookingRow) => void;
  singleDay: boolean;
}) {
  const gridHeight = hours.length * HOUR_PX;
  return (
    <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white">
      <div className={singleDay ? 'min-w-0' : 'min-w-[720px]'}>
        {/* Day headers */}
        {!singleDay && (
          <div className="flex border-b border-charcoal/10">
            <div className="w-14 shrink-0" />
            {days.map((d) => (
              <div key={d.toISOString()} className={`flex-1 border-l border-charcoal/10 py-2 text-center text-xs ${isToday(d) ? 'text-gold' : 'text-charcoal/60'}`}>
                <div className="font-medium">{format(d, 'EEE')}</div>
                <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${isToday(d) ? 'bg-gold text-charcoal' : ''}`}>{format(d, 'd')}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex">
          {/* Hour gutter */}
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="relative">
                <span className="absolute -top-2 right-2 text-[0.62rem] text-charcoal/40">{format(new Date(2000, 0, 1, h), 'ha').toLowerCase()}</span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d) => {
            const key = dayKey(d);
            const dayBookings = byDate.get(key) ?? [];
            const lanes = packLanes(dayBookings);
            const showNowLine = now && isSameDay(d, now);
            const nowOffset = now ? ((lh(now.toISOString()) - startHour) * 60 + lm(now.toISOString())) / 60 * HOUR_PX : 0;
            return (
              <div key={key} className="relative flex-1 border-l border-charcoal/10" style={{ height: gridHeight }}>
                {hours.map((h, i) => (
                  <div key={h} style={{ top: i * HOUR_PX, height: HOUR_PX }} className="absolute inset-x-0 border-b border-charcoal/[0.06]" />
                ))}
                {showNowLine && nowOffset >= 0 && nowOffset <= gridHeight && (
                  <div style={{ top: nowOffset }} className="absolute inset-x-0 z-20 flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span className="h-px flex-1 bg-rose-500/70" />
                  </div>
                )}
                {dayBookings.map((b) => {
                  const top = ((lh(b.appointment_start) - startHour) * 60 + lm(b.appointment_start)) / 60 * HOUR_PX;
                  const rawH = ((lh(b.appointment_end) * 60 + lm(b.appointment_end)) - (lh(b.appointment_start) * 60 + lm(b.appointment_start))) / 60 * HOUR_PX;
                  const height = Math.max(22, rawH);
                  const { lane, lanes: laneCount } = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
                  const st = statusStyle(b.status);
                  return (
                    <button
                      key={b.id}
                      onClick={() => onSelect(b)}
                      style={{ top, height, left: `calc(${(lane / laneCount) * 100}% + 2px)`, width: `calc(${100 / laneCount}% - 4px)` }}
                      className={`absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[0.68rem] leading-tight shadow-sm transition-shadow hover:shadow-md ${st.block}`}
                    >
                      <span className="block font-medium">
                        {formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'h:mm')}–{formatInTimeZone(new Date(b.appointment_end), STUDIO_TIMEZONE, 'h:mmaaa')}
                      </span>
                      <span className="block truncate font-medium">{b.customer_name}</span>
                      {height > 40 && <span className="block truncate opacity-75">{b.services?.name ?? ''}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  byDate,
  onPickDay,
  onSelect,
}: {
  anchor: Date;
  byDate: Map<string, BookingRow[]>;
  onPickDay: (d: Date) => void;
  onSelect: (b: BookingRow) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  });
  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white">
      <div className="grid grid-cols-7 border-b border-charcoal/10 text-center text-[0.62rem] uppercase tracking-luxe text-charcoal/40">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = dayKey(d);
          const list = byDate.get(key) ?? [];
          return (
            <div key={key} className={`min-h-[92px] border-b border-l border-charcoal/[0.06] p-1.5 ${isSameMonth(d, anchor) ? '' : 'bg-charcoal/[0.015]'}`}>
              <button onClick={() => onPickDay(d)} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(d) ? 'bg-gold text-charcoal' : isSameMonth(d, anchor) ? 'text-charcoal/70 hover:bg-charcoal/[0.06]' : 'text-charcoal/30'}`}>
                {format(d, 'd')}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((b) => {
                  const st = statusStyle(b.status);
                  return (
                    <button key={b.id} onClick={() => onSelect(b)} className={`block w-full truncate rounded border-l-2 px-1 py-0.5 text-left text-[0.6rem] leading-tight ${st.block}`}>
                      {formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'h:mm')} {b.customer_name}
                    </button>
                  );
                })}
                {list.length > 3 && (
                  <button onClick={() => onPickDay(d)} className="block w-full px-1 text-left text-[0.6rem] text-charcoal/45 hover:text-gold">+{list.length - 3} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

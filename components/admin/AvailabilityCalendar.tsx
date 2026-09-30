'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE, DEFAULT_SLOT_START_HOUR, DEFAULT_SLOT_END_HOUR } from '@/lib/booking/constants';
import type { DbSlotOverride } from '@/lib/booking/types';

type CalendarBooking = {
  id: string;
  appointment_start: string;
  appointment_end: string;
  customer_name: string;
  status: string;
  services: { name: string } | null;
};

type SlotStatus = 'available' | 'blocked' | 'booked';

function monthRange(monthStr: string) {
  const from = `${monthStr}-01`;
  const [y, m] = monthStr.split('-').map(Number);
  const through = format(endOfMonth(new Date(y, m - 1, 1)), 'yyyy-MM-dd');
  return { from, through };
}

export default function AvailabilityCalendar({
  initialMonth,
  initialOverrides,
  initialBookings,
}: {
  initialMonth: string;
  initialOverrides: DbSlotOverride[];
  initialBookings: CalendarBooking[];
}) {
  const [month, setMonth] = useState(initialMonth); // YYYY-MM
  const [overrides, setOverrides] = useState<DbSlotOverride[]>(initialOverrides);
  const [bookings, setBookings] = useState<CalendarBooking[]>(initialBookings);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newSlotTime, setNewSlotTime] = useState('18:00');

  async function loadMonth(monthStr: string) {
    setLoading(true);
    setError(null);
    const { from, through } = monthRange(monthStr);
    const [overridesRes, bookingsRes] = await Promise.all([
      fetch(`/api/admin/slot-overrides?from=${from}&through=${through}`),
      fetch(`/api/admin/bookings?from=${from}&through=${through}`),
    ]);
    setLoading(false);
    if (!overridesRes.ok || !bookingsRes.ok) {
      setError('Failed to load calendar data.');
      return;
    }
    const overridesData = await overridesRes.json();
    const bookingsData = await bookingsRes.json();
    setOverrides(overridesData.overrides ?? []);
    setBookings(bookingsData.bookings ?? []);
  }

  useEffect(() => {
    if (month === initialMonth) return; // already have initial data from the server
    loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const monthDate = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const overridesByDate = useMemo(() => {
    const map = new Map<string, DbSlotOverride[]>();
    for (const o of overrides) {
      map.set(o.date, [...(map.get(o.date) ?? []), o]);
    }
    return map;
  }, [overrides]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const d = formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'yyyy-MM-dd');
      map.set(d, [...(map.get(d) ?? []), b]);
    }
    return map;
  }, [bookings]);

  function goToMonth(next: Date) {
    setSelectedDate(null);
    setMonth(format(next, 'yyyy-MM'));
  }

  async function addOverride(date: string, startTime: string, action: 'open' | 'blocked') {
    const key = `${date}-${startTime}-${action}`;
    setBusyKey(key);
    setError(null);
    const res = await fetch('/api/admin/slot-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, startTime, action }),
    });
    setBusyKey(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'slot_booked' ? 'That slot already has a booking — remove/reschedule it first.' : 'Failed to save.');
      return;
    }
    loadMonth(month);
  }

  async function removeOverride(id: string) {
    setBusyKey(id);
    setError(null);
    const res = await fetch(`/api/admin/slot-overrides/${id}`, { method: 'DELETE' });
    setBusyKey(null);
    if (!res.ok) {
      setError('Failed to remove.');
      return;
    }
    loadMonth(month);
  }

  const selectedOverrides = selectedDate ? overridesByDate.get(selectedDate) ?? [] : [];
  const selectedBookings = selectedDate ? bookingsByDate.get(selectedDate) ?? [] : [];
  const blockedTimes = new Set(selectedOverrides.filter((o) => o.action === 'blocked').map((o) => o.start_time.slice(0, 5)));
  const openOverrides = selectedOverrides.filter((o) => o.action === 'open');

  function defaultSlotStatus(date: string, hh: string): SlotStatus {
    if (blockedTimes.has(hh)) return 'blocked';
    const slotStartUtc = fromZonedTime(`${date}T${hh}:00`, STUDIO_TIMEZONE);
    const slotEndUtc = new Date(slotStartUtc.getTime() + 60 * 60 * 1000);
    const isBooked = selectedBookings.some((b) => {
      const bStart = new Date(b.appointment_start);
      const bEnd = new Date(b.appointment_end);
      return bStart < slotEndUtc && bEnd > slotStartUtc;
    });
    return isBooked ? 'booked' : 'available';
  }

  const defaultHours: string[] = [];
  for (let h = DEFAULT_SLOT_START_HOUR; h <= DEFAULT_SLOT_END_HOUR; h++) {
    defaultHours.push(`${String(h).padStart(2, '0')}:00`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-xs text-cream/60">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cream/20" /> Default slot</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Admin-added slot</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Admin-blocked</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gold" /> Booked</span>
      </div>

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => goToMonth(subMonths(monthDate, 1))} className="text-sm text-cream/60 hover:text-gold">
              ← Prev
            </button>
            <h2 className="text-sm font-medium uppercase tracking-wide">{format(monthDate, 'MMMM yyyy')}</h2>
            <button onClick={() => goToMonth(addMonths(monthDate, 1))} className="text-sm text-cream/60 hover:text-gold">
              Next →
            </button>
          </div>
          {loading && <p className="mb-2 text-xs text-cream/40">Loading…</p>}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-cream/40">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, monthDate);
              const dayOverrides = overridesByDate.get(dateStr) ?? [];
              const hasBlocked = dayOverrides.some((o) => o.action === 'blocked');
              const hasOpen = dayOverrides.some((o) => o.action === 'open');
              const dayBookings = bookingsByDate.get(dateStr) ?? [];
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left text-xs transition ${
                    selectedDate === dateStr ? 'border-gold' : 'border-cream/10 hover:border-cream/30'
                  } ${inMonth ? '' : 'opacity-30'}`}
                >
                  <span className={isToday(day) ? 'rounded-full bg-gold px-1.5 text-charcoal' : ''}>{format(day, 'd')}</span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayBookings.length > 0 && (
                      <span className="rounded bg-gold/20 px-1 text-[10px] text-gold">{dayBookings.length} bkd</span>
                    )}
                    {hasOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                    {hasBlocked && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-cream/10 p-4">
          {!selectedDate ? (
            <p className="text-sm text-cream/50">Select a date to manage its slots.</p>
          ) : (
            <div className="space-y-5">
              <h3 className="text-sm font-medium">{format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM yyyy')}</h3>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">Default grid (08:00–16:00)</h4>
                <div className="flex flex-wrap gap-1.5">
                  {defaultHours.map((hh) => {
                    const status = defaultSlotStatus(selectedDate, hh);
                    const key = `${selectedDate}-${hh}`;
                    const busy = busyKey?.startsWith(key);
                    if (status === 'booked') {
                      return (
                        <span key={hh} className="rounded-full bg-gold/20 px-2 py-1 text-xs text-gold">
                          {hh} · booked
                        </span>
                      );
                    }
                    if (status === 'blocked') {
                      const override = selectedOverrides.find(
                        (o) => o.action === 'blocked' && o.start_time.slice(0, 5) === hh
                      );
                      return (
                        <button
                          key={hh}
                          disabled={busy || !override}
                          onClick={() => override && removeOverride(override.id)}
                          className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                          title="Click to unblock"
                        >
                          {hh} · blocked ✕
                        </button>
                      );
                    }
                    return (
                      <button
                        key={hh}
                        disabled={busy}
                        onClick={() => addOverride(selectedDate, hh, 'blocked')}
                        className="rounded-full border border-cream/20 px-2 py-1 text-xs text-cream/70 hover:border-red-400/40 hover:text-red-300"
                        title="Click to block"
                      >
                        {hh}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">Admin-added slots</h4>
                {openOverrides.length === 0 ? (
                  <p className="text-xs text-cream/40">None.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {openOverrides.map((o) => (
                      <button
                        key={o.id}
                        disabled={busyKey === o.id}
                        onClick={() => removeOverride(o.id)}
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
                        title="Click to remove"
                      >
                        {o.start_time.slice(0, 5)} ✕
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => addOverride(selectedDate, newSlotTime, 'open')}
                    disabled={!!busyKey}
                    className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-charcoal disabled:opacity-50"
                  >
                    Add extra slot
                  </button>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">Bookings this day</h4>
                {selectedBookings.length === 0 ? (
                  <p className="text-xs text-cream/40">None.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-cream/70">
                    {selectedBookings.map((b) => (
                      <li key={b.id}>
                        {formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'HH:mm')} — {b.customer_name} ·{' '}
                        {b.services?.name ?? '—'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

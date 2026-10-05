'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import type { DbBooking } from '@/lib/booking/types';

type BookingRow = DbBooking & {
  services: { name: string; service_time_mins: number } | null;
  booking_bundles: { quantity: number; price_pence_at_booking: number; bundle_variants: { inches: number; colour: string } | null }[];
  booking_addons: { name_at_booking: string; price_delta_pence_at_booking: number; duration_delta_mins_at_booking: number }[];
};
type ViewMode = 'month' | 'week' | 'day';

function rangeFor(view: ViewMode, anchor: Date): { from: string; through: string } {
  if (view === 'month') {
    return { from: format(startOfMonth(anchor), 'yyyy-MM-dd'), through: format(endOfMonth(anchor), 'yyyy-MM-dd') };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return { from: format(start, 'yyyy-MM-dd'), through: format(end, 'yyyy-MM-dd') };
  }
  const d = format(anchor, 'yyyy-MM-dd');
  return { from: d, through: d };
}

const STATUS_CHIP_CLASS: Record<string, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-sky-500/15 text-sky-300',
  no_show: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-cream/10 text-cream/50',
  expired: 'bg-cream/10 text-cream/50',
};

// Shared small-pill button look — same convention as BookingsTable.tsx — so
// every admin action button reads as a distinct tappable control instead of
// a bare underlined text link.
const PILL = 'inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50';
const PILL_GOLD = `${PILL} bg-gold/15 text-gold hover:bg-gold/25`;
const PILL_NEUTRAL = `${PILL} bg-cream/10 text-cream/70 hover:bg-cream/20`;
const PILL_RED = `${PILL} bg-red-500/15 text-red-300 hover:bg-red-500/25`;
const PILL_SKY = `${PILL} bg-sky-500/15 text-sky-300 hover:bg-sky-500/25`;

export default function BookingsCalendar() {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [resentId, setResentId] = useState<string | null>(null);

  async function load() {
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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor]);

  // CreateBookingModal lives outside this component (rendered once on the
  // bookings page so it's reachable from both the list and calendar views)
  // and has no direct reference to this component's `load`. It broadcasts
  // this event after a successful create so the calendar's own client-side
  // fetch picks up the new booking without a full page reload.
  useEffect(() => {
    function onBookingsChanged() {
      load();
    }
    window.addEventListener('admin-bookings-changed', onBookingsChanged);
    return () => window.removeEventListener('admin-bookings-changed', onBookingsChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const d = formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'yyyy-MM-dd');
      map.set(d, [...(map.get(d) ?? []), b]);
    }
    return map;
  }, [bookings]);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking?')) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: 'POST' });
    setBusyId(null);
    if (!res.ok) {
      setError('Failed to cancel booking.');
      return;
    }
    load();
  }

  async function handleStatus(id: string, status: 'completed' | 'no_show') {
    setBusyId(id);
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError('Failed to update booking status.');
      return;
    }
    load();
  }

  async function handleResendConfirmation(id: string) {
    setBusyId(id);
    setResentId(null);
    const res = await fetch(`/api/admin/bookings/${id}/resend-confirmation`, { method: 'POST' });
    setBusyId(null);
    if (!res.ok) {
      setError('Failed to resend confirmation email.');
      return;
    }
    setResentId(id);
  }

  async function handleSaveNotes(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/bookings/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft.trim() || null }),
    });
    setBusyId(null);
    if (!res.ok) {
      setError('Failed to save notes.');
      return;
    }
    setEditingNotesId(null);
    load();
  }

  function StatusChip({ status }: { status: string }) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CHIP_CLASS[status] ?? 'bg-gold/15 text-gold'}`}>
        {status}
      </span>
    );
  }

  function BookingLine({ b, detailed }: { b: BookingRow; detailed?: boolean }) {
    const isPast = new Date(b.appointment_start) <= new Date();
    const canTransition = b.status === 'confirmed' && isPast;
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-cream/10 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">
              {formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'HH:mm')} — {b.customer_name}
            </div>
            <div className="text-cream/50">
              {b.services?.name ?? '—'}
              {b.hair_included ? ' (hair included)' : ''}
              {detailed && (
                <>
                  {' · '}
                  {b.customer_email} · {b.customer_phone} · {formatPence(b.total_price_pence)} total ·{' '}
                  {formatPence(b.deposit_paid_pence || b.deposit_due_pence)} deposit
                </>
              )}
            </div>
            {detailed && (b.booking_addons.length > 0 || b.booking_bundles.length > 0) && (
              <div className="mt-0.5 text-cream/60">
                {b.booking_addons.length > 0 && (
                  <div>
                    <span className="text-cream/40">Extras: </span>
                    {b.booking_addons.map((a) => a.name_at_booking).join(', ')}
                  </div>
                )}
                {b.booking_bundles.length > 0 && (
                  <div>
                    <span className="text-cream/40">Bundles: </span>
                    {b.booking_bundles
                      .map((bu) => `${bu.quantity}× ${bu.bundle_variants?.inches ?? '?'}" (${bu.bundle_variants?.colour ?? '?'})`)
                      .join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
          <StatusChip status={b.status} />
        </div>

        {(b.status === 'confirmed' || (detailed && canTransition)) && (
          <div className="flex flex-wrap gap-2">
            {b.status === 'confirmed' && (
              <>
                <button onClick={() => handleCancel(b.id)} disabled={busyId === b.id} className={PILL_RED}>
                  Cancel
                </button>
                <button onClick={() => handleResendConfirmation(b.id)} disabled={busyId === b.id} className={PILL_NEUTRAL}>
                  {resentId === b.id ? 'Sent' : 'Resend confirmation'}
                </button>
              </>
            )}
            {detailed && canTransition && (
              <>
                <button onClick={() => handleStatus(b.id, 'completed')} disabled={busyId === b.id} className={PILL_SKY}>
                  Mark completed
                </button>
                <button onClick={() => handleStatus(b.id, 'no_show')} disabled={busyId === b.id} className={PILL_RED}>
                  No-show
                </button>
              </>
            )}
          </div>
        )}

        {detailed &&
          (editingNotesId === b.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button onClick={() => handleSaveNotes(b.id)} disabled={busyId === b.id} className={PILL_GOLD}>
                  Save
                </button>
                <button onClick={() => setEditingNotesId(null)} className={PILL_NEUTRAL}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditingNotesId(b.id);
                setNotesDraft(b.notes ?? '');
              }}
              className="text-left text-cream/50 hover:text-gold"
            >
              {b.notes ? b.notes : <span className="italic text-cream/30">Add notes</span>}
            </button>
          ))}
      </div>
    );
  }

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(anchor, { weekStartsOn: 1 }) });
  }, [anchor]);

  function goPrev() {
    setSelectedDate(null);
    setAnchor(view === 'month' ? subMonths(anchor, 1) : view === 'week' ? subWeeks(anchor, 1) : subDays(anchor, 1));
  }
  function goNext() {
    setSelectedDate(null);
    setAnchor(view === 'month' ? addMonths(anchor, 1) : view === 'week' ? addWeeks(anchor, 1) : addDays(anchor, 1));
  }

  const dayStr = format(anchor, 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-cream/10 p-1 text-xs">
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setSelectedDate(null);
                setView(v);
              }}
              className={`rounded-full px-3 py-1 capitalize ${view === v ? 'bg-gold text-charcoal' : 'text-cream/60 hover:text-cream'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={goPrev} className={PILL_NEUTRAL}>← Prev</button>
          <span className="font-medium">
            {view === 'month' ? format(anchor, 'MMMM yyyy') : view === 'week'
              ? `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM yyyy')}`
              : format(anchor, 'EEEE d MMMM yyyy')}
          </span>
          <button onClick={goNext} className={PILL_NEUTRAL}>Next →</button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {loading && <p className="text-xs text-cream/40">Loading…</p>}

      {view === 'month' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-cream/40">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayBookings = bookingsByDate.get(dateStr) ?? [];
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex min-h-[56px] flex-col items-start rounded-lg border p-1.5 text-left text-xs ${
                      selectedDate === dateStr ? 'border-gold' : 'border-cream/10 hover:border-cream/30'
                    } ${isSameMonth(day, anchor) ? '' : 'opacity-30'}`}
                  >
                    <span className={isToday(day) ? 'rounded-full bg-gold px-1.5 text-charcoal' : ''}>{format(day, 'd')}</span>
                    {dayBookings.length > 0 && (
                      <span className="mt-1 rounded bg-gold/20 px-1 text-[10px] text-gold">{dayBookings.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-cream/10 p-4">
            {!selectedDate ? (
              <p className="text-sm text-cream/50">Select a date to see its bookings.</p>
            ) : (
              <div className="space-y-2">
                <h3 className="mb-2 text-sm font-medium">{format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM')}</h3>
                {(bookingsByDate.get(selectedDate) ?? []).length === 0 ? (
                  <p className="text-xs text-cream/40">No bookings.</p>
                ) : (
                  (bookingsByDate.get(selectedDate) ?? []).map((b) => <BookingLine key={b.id} b={b} detailed />)
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate.get(dateStr) ?? [];
            return (
              <div key={dateStr} className="space-y-2 rounded-xl border border-cream/10 p-3">
                <div className={`text-xs font-medium ${isToday(day) ? 'text-gold' : 'text-cream/70'}`}>
                  {format(day, 'EEE d')}
                </div>
                {dayBookings.length === 0 ? (
                  <p className="text-[11px] text-cream/40">—</p>
                ) : (
                  dayBookings.map((b) => {
                    const isPast = new Date(b.appointment_start) <= new Date();
                    const canTransition = b.status === 'confirmed' && isPast;
                    return (
                      <div key={b.id} className="rounded-lg border border-cream/10 px-2 py-1 text-[11px]">
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-medium">{formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'HH:mm')}</div>
                          <StatusChip status={b.status} />
                        </div>
                        <div className="text-cream/60">{b.customer_name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {b.status === 'confirmed' && (
                            <>
                              <button onClick={() => handleCancel(b.id)} disabled={busyId === b.id} className={PILL_RED}>
                                Cancel
                              </button>
                              <button onClick={() => handleResendConfirmation(b.id)} disabled={busyId === b.id} className={PILL_NEUTRAL}>
                                {resentId === b.id ? 'Sent' : 'Resend'}
                              </button>
                            </>
                          )}
                          {canTransition && (
                            <>
                              <button onClick={() => handleStatus(b.id, 'completed')} disabled={busyId === b.id} className={PILL_SKY}>
                                Completed
                              </button>
                              <button onClick={() => handleStatus(b.id, 'no_show')} disabled={busyId === b.id} className={PILL_RED}>
                                No-show
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="space-y-2">
          {(bookingsByDate.get(dayStr) ?? []).length === 0 ? (
            <p className="text-sm text-cream/50">No bookings this day.</p>
          ) : (
            (bookingsByDate.get(dayStr) ?? []).map((b) => <BookingLine key={b.id} b={b} detailed />)
          )}
        </div>
      )}
    </div>
  );
}

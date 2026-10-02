'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import type { DbBooking } from '@/lib/booking/types';

type BookingRow = DbBooking & { services: { name: string; service_time_mins: number } | null };

const STATUS_CHIP_CLASS: Record<string, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-sky-500/15 text-sky-300',
  no_show: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-cream/10 text-cream/50',
  expired: 'bg-cream/10 text-cream/50',
};

// Shared small-pill button look reused across every admin action button —
// filled background (not just an underlined text link) so each one reads as
// a distinct tappable control instead of running together in a dense row.
const PILL = 'inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50';
const PILL_GOLD = `${PILL} bg-gold/15 text-gold hover:bg-gold/25`;
const PILL_NEUTRAL = `${PILL} bg-cream/10 text-cream/70 hover:bg-cream/20`;
const PILL_RED = `${PILL} bg-red-500/15 text-red-300 hover:bg-red-500/25`;
const PILL_SKY = `${PILL} bg-sky-500/15 text-sky-300 hover:bg-sky-500/25`;

export default function BookingsTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const router = useRouter();
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newStart, setNewStart] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking?')) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to cancel booking.');
      return;
    }
    router.refresh();
  }

  async function handleReschedule(id: string) {
    if (!newStart) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStart: new Date(newStart).toISOString() }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'slot_taken' ? 'That time overlaps another booking.' : 'Failed to reschedule.');
      return;
    }
    setRescheduling(null);
    setNewStart('');
    router.refresh();
  }

  async function handleStatus(id: string, status: 'completed' | 'no_show') {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update booking status.');
      return;
    }
    router.refresh();
  }

  async function handleResendConfirmation(id: string) {
    setBusy(id);
    setError(null);
    setResent(null);
    const res = await fetch(`/api/admin/bookings/${id}/resend-confirmation`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to resend confirmation email.');
      return;
    }
    setResent(id);
  }

  async function handleSaveNotes(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft.trim() || null }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save notes.');
      return;
    }
    setEditingNotes(null);
    router.refresh();
  }

  if (initialBookings.length === 0) {
    return <p className="text-sm text-cream/60">No upcoming bookings.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
      {initialBookings.map((booking) => {
        const isPast = new Date(booking.appointment_start) <= new Date();
        const canTransition = booking.status === 'confirmed' && isPast;
        return (
          <div key={booking.id} className="rounded-xl border border-cream/10 bg-cream/[0.02] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {formatInTimeZone(new Date(booking.appointment_start), STUDIO_TIMEZONE, 'd MMM yyyy, h:mmaaa')}
                  </span>
                  {booking.created_by_admin && (
                    <span className="rounded bg-cream/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cream/50">
                      manual
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CHIP_CLASS[booking.status] ?? 'bg-gold/15 text-gold'}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="mt-1 text-sm">{booking.customer_name}</div>
                <div className="text-xs text-cream/50">
                  {booking.customer_email} · {booking.customer_phone}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-cream/50">{booking.services?.name ?? '—'}</div>
                <div className="font-medium">{formatPence(booking.deposit_paid_pence || booking.deposit_due_pence)}</div>
              </div>
            </div>

            <div className="mt-3 border-t border-cream/5 pt-3">
              {editingNotes === booking.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-cream/20 bg-transparent px-2 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveNotes(booking.id)} disabled={busy === booking.id} className={PILL_GOLD}>
                      Save
                    </button>
                    <button onClick={() => setEditingNotes(null)} className={PILL_NEUTRAL}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingNotes(booking.id);
                    setNotesDraft(booking.notes ?? '');
                  }}
                  className="text-left text-xs text-cream/60 hover:text-gold"
                  title="Edit notes"
                >
                  {booking.notes ? booking.notes : <span className="italic text-cream/30">Add notes</span>}
                </button>
              )}
            </div>

            <div className="mt-3 border-t border-cream/5 pt-3">
              {rescheduling === booking.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="rounded-lg border border-cream/20 bg-transparent px-2 py-1.5 text-xs"
                  />
                  <button onClick={() => handleReschedule(booking.id)} disabled={busy === booking.id} className={PILL_GOLD}>
                    Save
                  </button>
                  <button onClick={() => setRescheduling(null)} className={PILL_NEUTRAL}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {booking.status === 'confirmed' && (
                    <>
                      <button onClick={() => setRescheduling(booking.id)} className={PILL_NEUTRAL}>
                        Reschedule
                      </button>
                      <button onClick={() => handleCancel(booking.id)} disabled={busy === booking.id} className={PILL_RED}>
                        Cancel
                      </button>
                      <button onClick={() => handleResendConfirmation(booking.id)} disabled={busy === booking.id} className={PILL_NEUTRAL}>
                        {resent === booking.id ? 'Sent' : 'Resend confirmation'}
                      </button>
                    </>
                  )}
                  {canTransition && (
                    <>
                      <button onClick={() => handleStatus(booking.id, 'completed')} disabled={busy === booking.id} className={PILL_SKY}>
                        Mark completed
                      </button>
                      <button onClick={() => handleStatus(booking.id, 'no_show')} disabled={busy === booking.id} className={PILL_RED}>
                        No-show
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

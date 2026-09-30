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

export default function BookingsTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const router = useRouter();
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newStart, setNewStart] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="overflow-x-auto rounded-xl border border-cream/10">
      {error && <p className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-cream/10 text-xs uppercase tracking-wide text-cream/50">
          <tr>
            <th className="px-4 py-3">Date &amp; time</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deposit</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {initialBookings.map((booking) => {
            const isPast = new Date(booking.appointment_start) <= new Date();
            const canTransition = booking.status === 'confirmed' && isPast;
            return (
              <tr key={booking.id} className="border-b border-cream/5 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatInTimeZone(new Date(booking.appointment_start), STUDIO_TIMEZONE, 'd MMM yyyy, h:mmaaa')}
                  {booking.created_by_admin && (
                    <span className="ml-2 rounded bg-cream/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cream/50">
                      manual
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div>{booking.customer_name}</div>
                  <div className="text-xs text-cream/50">
                    {booking.customer_email} · {booking.customer_phone}
                  </div>
                </td>
                <td className="px-4 py-3">{booking.services?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CHIP_CLASS[booking.status] ?? 'bg-gold/15 text-gold'}`}
                  >
                    {booking.status}
                  </span>
                </td>
                <td className="px-4 py-3">{formatPence(booking.deposit_paid_pence || booking.deposit_due_pence)}</td>
                <td className="px-4 py-3 max-w-[220px]">
                  {editingNotes === booking.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveNotes(booking.id)}
                          disabled={busy === booking.id}
                          className="text-xs text-gold hover:underline"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingNotes(null)} className="text-xs text-cream/50 hover:underline">
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
                </td>
                <td className="px-4 py-3">
                  {rescheduling === booking.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={newStart}
                        onChange={(e) => setNewStart(e.target.value)}
                        className="rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleReschedule(booking.id)}
                        disabled={busy === booking.id}
                        className="text-xs text-gold hover:underline"
                      >
                        Save
                      </button>
                      <button onClick={() => setRescheduling(null)} className="text-xs text-cream/50 hover:underline">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {booking.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => setRescheduling(booking.id)}
                            className="text-xs text-cream/70 hover:text-gold"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={busy === booking.id}
                            className="text-xs text-red-300 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {canTransition && (
                        <>
                          <button
                            onClick={() => handleStatus(booking.id, 'completed')}
                            disabled={busy === booking.id}
                            className="text-xs text-sky-300 hover:underline"
                          >
                            Mark completed
                          </button>
                          <button
                            onClick={() => handleStatus(booking.id, 'no_show')}
                            disabled={busy === booking.id}
                            className="text-xs text-red-300 hover:underline"
                          >
                            No-show
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

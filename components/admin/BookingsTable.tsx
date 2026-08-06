'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import type { DbBooking } from '@/lib/booking/types';

type BookingRow = DbBooking & { services: { name: string; duration_mins: number } | null };

export default function BookingsTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const router = useRouter();
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newStart, setNewStart] = useState('');
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
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {initialBookings.map((booking) => (
            <tr key={booking.id} className="border-b border-cream/5 last:border-0">
              <td className="px-4 py-3 whitespace-nowrap">
                {formatInTimeZone(new Date(booking.appointment_start), STUDIO_TIMEZONE, 'd MMM yyyy, h:mmaaa')}
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
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    booking.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gold/15 text-gold'
                  }`}
                >
                  {booking.status}
                </span>
              </td>
              <td className="px-4 py-3">{formatPence(booking.deposit_paid_pence || booking.deposit_due_pence)}</td>
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
                  <div className="flex items-center gap-3">
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
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

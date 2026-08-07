'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type BlockedDate = {
  id: string;
  blocked_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export default function BlockedDatesForm({ initialBlockedDates }: { initialBlockedDates: BlockedDate[] }) {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [wholeDay, setWholeDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/admin/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockedDate: date,
        startTime: wholeDay ? null : startTime,
        endTime: wholeDay ? null : endTime,
        reason: reason || null,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError('Failed to add blocked date.');
      return;
    }

    setDate('');
    setReason('');
    router.refresh();
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this block?')) return;
    const res = await fetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={handleAdd} className="space-y-4 rounded-xl border border-cream/10 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-cream/60">Block a date</h2>
        {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div>
          <label className="mb-1 block text-xs text-cream/50" htmlFor="blocked-date">
            Date
          </label>
          <input
            id="blocked-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wholeDay} onChange={(e) => setWholeDay(e.target.checked)} />
          Block whole day
        </label>
        {!wholeDay && (
          <div className="flex gap-4">
            <div>
              <label className="mb-1 block text-xs text-cream/50" htmlFor="start-time">
                From
              </label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-cream/50" htmlFor="end-time">
                To
              </label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-cream/50" htmlFor="reason">
            Reason (optional)
          </label>
          <input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add block'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-cream/60">Current blocks</h2>
        {initialBlockedDates.length === 0 ? (
          <p className="text-sm text-cream/50">No blocked dates.</p>
        ) : (
          <ul className="space-y-2">
            {initialBlockedDates.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-cream/10 px-4 py-2 text-sm"
              >
                <span>
                  {b.blocked_date}
                  {b.start_time && b.end_time ? ` · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}` : ' · whole day'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </span>
                <button onClick={() => handleRemove(b.id)} className="text-xs text-red-300 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

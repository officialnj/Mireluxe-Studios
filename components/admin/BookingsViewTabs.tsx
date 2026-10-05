'use client';

import { useState } from 'react';
import BookingsTable, { type BookingRow } from '@/components/admin/BookingsTable';
import BookingsCalendar from '@/components/admin/BookingsCalendar';

/**
 * Toggles between the original flat-list BookingsTable and the new
 * day/week/month BookingsCalendar. The list view keeps its existing
 * reschedule flow (the calendar view only supports cancel — see
 * BookingsCalendar) so neither is a strict replacement for the other.
 */
export default function BookingsViewTabs({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [view, setView] = useState<'list' | 'calendar'>('list');

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full border border-cream/10 p-1 text-xs w-fit">
        {(['list', 'calendar'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 capitalize ${view === v ? 'bg-gold text-charcoal' : 'text-cream/60 hover:text-cream'}`}
          >
            {v}
          </button>
        ))}
      </div>
      {view === 'list' ? <BookingsTable initialBookings={initialBookings} /> : <BookingsCalendar />}
    </div>
  );
}

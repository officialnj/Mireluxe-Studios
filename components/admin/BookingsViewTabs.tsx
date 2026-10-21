'use client';

import { useState } from 'react';
import BookingsTable, { type BookingRow } from '@/components/admin/BookingsTable';
import CalendarView from '@/components/admin/CalendarView';
import CreateBookingModal from '@/components/admin/CreateBookingModal';

/**
 * Admin Calendar landing. Defaults to the Acuity-style time-grid CalendarView
 * (Day/Week/Month, appointment selection → edit/reschedule/cancel). A flat
 * "List" view is kept as a secondary option for quickly scanning/acting on
 * many bookings at once. CalendarView renders its own Create Booking control
 * in its top bar, so the list view keeps the standalone modal trigger.
 */
export default function BookingsViewTabs({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  return (
    <div>
      <div className="mb-5 flex w-fit gap-1 rounded-full border border-charcoal/10 bg-white p-1 text-xs">
        {(['calendar', 'list'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 capitalize transition-colors ${view === v ? 'bg-gold text-charcoal' : 'text-charcoal/60 hover:text-charcoal'}`}
          >
            {v}
          </button>
        ))}
      </div>
      {view === 'calendar' ? (
        <CalendarView />
      ) : (
        <div>
          <div className="mb-4">
            <CreateBookingModal />
          </div>
          <BookingsTable initialBookings={initialBookings} />
        </div>
      )}
    </div>
  );
}

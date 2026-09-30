'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/booking/DatePicker';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import { formatPence } from '@/lib/booking/pricing';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import type { DbBooking, DbService, TimeSlot } from '@/lib/booking/types';

type Props = {
  booking: DbBooking;
  service: DbService | null;
};

const STATUS_COPY: Record<DbBooking['status'], string> = {
  pending_payment: 'This booking is still awaiting payment confirmation. If you believe this is an error, please contact the studio directly.',
  confirmed: '',
  cancelled: 'This booking has been cancelled.',
  completed: 'This appointment has already taken place — thank you for visiting MIRILUXE Studios!',
  expired: 'This booking hold expired before payment was completed and is no longer active.',
  no_show: 'This appointment was marked as a no-show.',
};

function rescheduleErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not_reschedulable':
      return 'This booking can no longer be rescheduled.';
    case 'past_cutoff':
      return 'Reschedules must be made at least 48 hours before your appointment. Please contact the studio directly for changes within this window.';
    case 'service_not_found':
      return 'Something went wrong loading this service — please contact the studio directly.';
    case 'slot_unavailable':
    case 'slot_taken':
      return 'That time is no longer available — please choose another.';
    case 'invalid_payload':
      return 'Please choose a valid date and time.';
    default:
      return 'Something went wrong — please try again or contact the studio directly.';
  }
}

function cancelErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not_cancellable':
      return 'This booking can no longer be cancelled.';
    case 'past_cutoff':
      return 'Cancellations must be made at least 48 hours before your appointment. Please contact the studio directly for changes within this window.';
    case 'refund_failed':
      return 'We could not process your refund automatically — please contact the studio directly.';
    default:
      return 'Something went wrong — please try again or contact the studio directly.';
  }
}

function formatAppointment(iso: string): string {
  const date = new Date(iso);
  return `${formatInTimeZone(date, STUDIO_TIMEZONE, 'EEEE d MMMM yyyy')} · ${formatInTimeZone(date, STUDIO_TIMEZONE, 'h:mmaaa')}`;
}

export default function ManageBookingClient({ booking: initialBooking, service }: Props) {
  const [booking, setBooking] = useState(initialBooking);
  const [mode, setMode] = useState<'view' | 'reschedule' | 'confirm-cancel'>('view');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  async function handleReschedule() {
    if (!selectedSlot || !dateStr) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, slotStart: selectedSlot.start }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(rescheduleErrorMessage(data.error));
        return;
      }
      setBooking((prev) => ({ ...prev, appointment_start: data.appointmentStart, appointment_end: data.appointmentEnd }));
      setSuccessMessage('Your appointment has been rescheduled.');
      setMode('view');
      setSelectedDate(undefined);
      setSelectedSlot(null);
    } catch {
      setErrorMessage('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(cancelErrorMessage(data.error));
        setMode('view');
        return;
      }
      setBooking((prev) => ({ ...prev, status: 'cancelled' }));
      setSuccessMessage('Your booking has been cancelled. Any eligible deposit refund has been issued automatically.');
      setMode('view');
    } catch {
      setErrorMessage('Network error — please check your connection and try again.');
      setMode('view');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-luxe max-w-2xl pb-24 lg:pb-32">
      <Reveal>
        {errorMessage && (
          <p className="mb-6 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="mb-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-charcoal/75 dark:text-cream/75">
            {successMessage}
          </p>
        )}

        <div className="rounded-2xl border border-charcoal/12 p-6 dark:border-cream/12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-serif text-xl font-light tracking-tight">
              {service?.name ?? 'Your appointment'}
            </span>
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] uppercase tracking-luxe text-gold">
              {booking.status.replace('_', ' ')}
            </span>
          </div>
          <p className="mt-2 text-sm text-charcoal/70 dark:text-cream/70">{formatAppointment(booking.appointment_start)}</p>
          {booking.hair_included && (
            <p className="mt-1 text-xs text-charcoal/50 dark:text-cream/50">Hair included</p>
          )}
          <div className="mt-4 space-y-1.5 text-sm text-charcoal/70 dark:text-cream/70">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span>{formatPence(booking.total_price_pence)}</span>
            </div>
            <div className="flex items-center justify-between text-gold">
              <span>Deposit paid</span>
              <span className="font-medium">{formatPence(booking.deposit_paid_pence || booking.deposit_due_pence)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-charcoal/50 dark:text-cream/50">
              <span>Balance at appointment</span>
              <span>{formatPence(booking.total_price_pence - (booking.deposit_paid_pence || booking.deposit_due_pence))}</span>
            </div>
          </div>
        </div>

        {booking.status !== 'confirmed' && STATUS_COPY[booking.status] && (
          <p className="mt-6 text-sm text-charcoal/65 dark:text-cream/65">{STATUS_COPY[booking.status]}</p>
        )}

        {booking.status === 'confirmed' && mode === 'view' && (
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              disabled={!service}
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setMode('reschedule');
              }}
            >
              Reschedule
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setMode('confirm-cancel');
              }}
            >
              Cancel booking
            </Button>
          </div>
        )}

        {booking.status === 'confirmed' && mode === 'confirm-cancel' && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/5 p-6">
            <p className="text-sm text-charcoal/75 dark:text-cream/75">
              Are you sure you want to cancel this booking? This cannot be undone.
            </p>
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setMode('view')}>
                Keep booking
              </Button>
              <Button type="button" size="md" className="flex-1" disabled={submitting} onClick={handleCancel}>
                {submitting ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
            </div>
          </div>
        )}

        {booking.status === 'confirmed' && mode === 'reschedule' && service && (
          <div className="mt-6">
            <p className="mb-4 text-sm text-charcoal/65 dark:text-cream/65">Choose a new date and time.</p>
            <DatePicker
              serviceId={service.id}
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
            />
            {dateStr && (
              <div className="mt-6">
                <p className="mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60">
                  Available times
                </p>
                <TimeSlotPicker serviceId={service.id} date={dateStr} selected={selectedSlot} onSelect={setSelectedSlot} />
              </div>
            )}
            <div className="mt-8 flex gap-3">
              <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button type="button" size="md" className="flex-1" disabled={!selectedSlot || submitting} onClick={handleReschedule}>
                {submitting ? 'Saving…' : 'Confirm new time'}
              </Button>
            </div>
          </div>
        )}
      </Reveal>
    </div>
  );
}

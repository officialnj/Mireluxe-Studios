'use client';

import { useEffect, useState } from 'react';
import type { TimeSlot } from '@/lib/booking/types';

type Props = {
  serviceId: string;
  date: string; // YYYY-MM-DD
  selected: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
};

export default function TimeSlotPicker({ serviceId, date, selected, onSelect }: Props) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [fullyBooked, setFullyBooked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability/slots?serviceId=${serviceId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setFullyBooked(!!data.fullyBooked);
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setFullyBooked(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, date]);

  if (loading) {
    return <p className="text-sm text-charcoal/50 dark:text-cream/50">Loading times…</p>;
  }

  if (fullyBooked || slots.length === 0) {
    return (
      <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-charcoal/70 dark:text-cream/70">
        This date is fully booked — please choose another date.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const active = selected?.start === slot.start;
        return (
          <button
            key={slot.start}
            type="button"
            onClick={() => onSelect(slot)}
            className={`rounded-xl border px-3 py-2.5 text-sm transition-colors duration-300 ${
              active
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-charcoal/12 hover:border-gold/50 dark:border-cream/12'
            }`}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}

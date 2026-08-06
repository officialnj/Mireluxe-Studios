'use client';

import { useEffect, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay } from 'date-fns';
import 'react-day-picker/dist/style.css';
import type { AvailableDayMap } from '@/lib/booking/types';

type Props = {
  serviceId: string;
  selected: Date | undefined;
  onSelect: (date: Date) => void;
};

// Calendar days are compared as plain YYYY-MM-DD strings using the browser's
// local calendar, matching how the server keys its Europe/London-calendar
// availability map — this is the standard approach for date-only booking
// widgets and avoids conflating "which day" with "what instant".
export default function DatePicker({ serviceId, selected, onSelect }: Props) {
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [availableDays, setAvailableDays] = useState<AvailableDayMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const monthStr = format(month, 'yyyy-MM');
    fetch(`/api/availability/days?serviceId=${serviceId}&month=${monthStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvailableDays(data.days ?? {});
      })
      .catch(() => {
        if (!cancelled) setAvailableDays({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, month]);

  return (
    <div className="relative">
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => date && onSelect(date)}
        month={month}
        onMonthChange={setMonth}
        fromMonth={startOfDay(new Date())}
        className="rdp-luxe mx-auto"
        disabled={(date) => availableDays[format(date, 'yyyy-MM-dd')] !== true}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-cream/70 text-xs uppercase tracking-luxe text-charcoal/50 dark:bg-charcoal/70 dark:text-cream/50">
          Loading availability…
        </div>
      )}
    </div>
  );
}

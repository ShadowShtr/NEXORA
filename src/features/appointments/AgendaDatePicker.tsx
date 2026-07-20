'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { CalendarView } from './domain/calendar-navigation';

// Visual refinement mid-2026: a native date input driving the same ?view=&date= URL
// state every other agenda navigation link already uses (view switcher, anterior/
// seguinte) — jumping to an arbitrary date doesn't need its own client-side date-picker
// component, the browser already has one.
export function AgendaDatePicker({
  view,
  dateKey,
  label,
}: {
  view: CalendarView;
  dateKey: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <label className="agenda-date-picker">
      <span>{label}</span>
      <ChevronDown size={16} aria-hidden="true" />
      <input
        type="date"
        defaultValue={dateKey}
        aria-label="Escolher data"
        onChange={(event) => {
          if (event.target.value) {
            router.push(`/dashboard/agenda?view=${view}&date=${event.target.value}`);
          }
        }}
      />
    </label>
  );
}

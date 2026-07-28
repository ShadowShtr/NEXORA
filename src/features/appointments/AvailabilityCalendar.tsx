'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { buildCalendarMonth, shiftMonthKey } from '@/app/b/[slug]/domain/month-calendar';
import { groupSlotsByDay } from '@/app/b/[slug]/domain/slot-formatting';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

// Extracted from the Nova marcação wizard's ScheduleStep so a second real consumer
// (reschedule, AppointmentPrimaryActions.tsx) doesn't have to re-implement the exact
// same calendar+time-grid — both need "pick a real, already-available slot" for the
// same reason: a blind date/time input lets the dona choose a time that's already taken,
// only failing loudly after she submits (SLOT_TAKEN) instead of never being offered in
// the first place. Reuses the public booking flow's own domain modules
// (buildCalendarMonth/shiftMonthKey/groupSlotsByDay, src/app/b/[slug]/domain) and
// calendar CSS — same widget everywhere a slot needs picking in this app.
export function AvailabilityCalendar({
  totalMinutes,
  timezone,
  slots,
  slotsError,
  selectedSlotIso,
  onSelectSlot,
}: {
  totalMinutes: number;
  timezone: string;
  slots: string[] | null;
  slotsError: string | null;
  selectedSlotIso: string | null;
  onSelectSlot: (iso: string) => void;
}) {
  const [todayKey] = useState(() => formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd'));
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));
  const [pickedDateKey, setPickedDateKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => (slots ? groupSlotsByDay(slots, timezone, totalMinutes) : []),
    [slots, timezone, totalMinutes],
  );
  const groupsByDateKey = useMemo(() => {
    const map = new Map<string, (typeof groups)[number]>();
    for (const group of groups) map.set(group.dateKey, group);
    return map;
  }, [groups]);

  const selectedDateKey =
    pickedDateKey && groupsByDateKey.has(pickedDateKey)
      ? pickedDateKey
      : (groups[0]?.dateKey ?? null);
  const selectedGroup = selectedDateKey ? groupsByDateKey.get(selectedDateKey) : undefined;

  // The strip only shows one screen's worth of days — without this, the default/picked
  // day (never the 1st of the month, since past days are disabled) would land scrolled
  // out of view with no hint it's even there. Matches SlotPicker.tsx (public booking).
  useEffect(() => {
    if (!selectedDateKey || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-date-key="${selectedDateKey}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDateKey, monthKey]);

  if (slotsError) {
    return (
      <p role="alert" className="form-error">
        {slotsError}
      </p>
    );
  }
  if (slots === null) {
    return (
      <p aria-live="polite" className="text-support">
        A carregar horários…
      </p>
    );
  }
  if (groups.length === 0) {
    return <p className="text-support">Sem horários disponíveis nos próximos dias.</p>;
  }

  return (
    <>
      <div className="calendar">
        <div className="calendar-header">
          <button
            type="button"
            className="calendar-nav"
            aria-label="Mês anterior"
            onClick={() => setMonthKey((key) => shiftMonthKey(key, -1))}
          >
            ‹
          </button>
          <p className="calendar-month-label">
            {buildCalendarMonth(monthKey, new Set(groupsByDateKey.keys()), todayKey).label}
          </p>
          <button
            type="button"
            className="calendar-nav"
            aria-label="Mês seguinte"
            onClick={() => setMonthKey((key) => shiftMonthKey(key, 1))}
          >
            ›
          </button>
        </div>

        <div className="calendar-strip" role="grid" ref={stripRef}>
          {buildCalendarMonth(monthKey, new Set(groupsByDateKey.keys()), todayKey)
            .days.filter((day) => day.inCurrentMonth)
            .map((day) => {
              const disabled = day.isPast || !day.hasSlots;
              const selected = selectedDateKey === day.dateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  role="gridcell"
                  className="calendar-day"
                  data-date-key={day.dateKey}
                  data-has-slots={day.hasSlots}
                  aria-selected={selected}
                  aria-label={day.dateKey}
                  disabled={disabled}
                  onClick={() => setPickedDateKey(day.dateKey)}
                >
                  <span className="calendar-day-weekday">{weekdayLabel(day.dateKey)}</span>
                  <span className="calendar-day-number">{day.dayOfMonth}</span>
                </button>
              );
            })}
        </div>
      </div>

      {selectedGroup ? (
        <div className="calendar-times">
          <p className="calendar-times-label">Horários disponíveis</p>
          <ul className="public-slot-list">
            {selectedGroup.slots.map((slot) => (
              <li key={slot.iso}>
                <button
                  type="button"
                  className="public-slot-button"
                  aria-pressed={selectedSlotIso === slot.iso}
                  onClick={() => onSelectSlot(slot.iso)}
                >
                  {slot.timeLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

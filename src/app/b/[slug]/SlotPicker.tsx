'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Card } from '@/components/ui/Card';
import { getPublicAvailability } from './availability-actions';
import { groupSlotsByDay } from './domain/slot-formatting';
import { buildCalendarMonth, shiftMonthKey } from './domain/month-calendar';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; slotsIso: string[] };

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// dateKey is always "yyyy-MM-dd" built from UTC year/month/day components (see
// buildCalendarMonth) — reading it back with Date.UTC keeps day-of-week derivation
// consistent with how the grid itself was built, no timezone library needed for this.
function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

// A month calendar (pick a day) feeding a time-of-day list (pick a slot), the shape
// visitors already expect from any booking product. Days with no computed availability
// are shown but disabled rather than hidden — a visitor scanning the grid can see at a
// glance which days have room, instead of days silently vanishing.
export function SlotPicker({
  tenantId,
  timezone,
  totalMinutes,
  selectedIso,
  onSelect,
  reloadKey,
}: {
  tenantId: string;
  timezone: string;
  totalMinutes: number;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  reloadKey: number;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Lazy initializer: Date.now() runs exactly once, at mount, never during a re-render
  // (the React Compiler purity rule forbids reading it directly in the render body).
  const [todayKey] = useState(() => formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd'));
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));
  const [pickedDateKey, setPickedDateKey] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) setState({ status: 'loading' });
      const result = await getPublicAvailability({
        tenantId,
        serviceDurationMinutes: totalMinutes,
      });
      if (cancelled) return;
      if (!result.ok) {
        setState({
          status: 'error',
          message: 'Não foi possível carregar os horários disponíveis. Tente novamente.',
        });
        return;
      }
      setState({ status: 'ready', slotsIso: result.value.slotsIso });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, totalMinutes, reloadKey]);

  const groups = useMemo(
    () => (state.status === 'ready' ? groupSlotsByDay(state.slotsIso, timezone, totalMinutes) : []),
    [state, timezone, totalMinutes],
  );
  const groupsByDateKey = useMemo(() => {
    const map = new Map<string, (typeof groups)[number]>();
    for (const group of groups) map.set(group.dateKey, group);
    return map;
  }, [groups]);

  // Derived during render, not synced via an effect: falls back to the first day that
  // actually has slots whenever the explicit pick is unset or no longer valid (e.g.
  // after a reload following SLOT_TAKEN) — no extra render pass, no setState-in-effect.
  const selectedDateKey =
    pickedDateKey && groupsByDateKey.has(pickedDateKey)
      ? pickedDateKey
      : (groups[0]?.dateKey ?? null);

  // The strip only shows one screen's worth of days at a time — without this, landing
  // on a month where the selected/default day is the 18th would leave it scrolled out of
  // view to the right, with no visual hint it's even there.
  useEffect(() => {
    if (!selectedDateKey || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-date-key="${selectedDateKey}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDateKey, monthKey]);

  if (state.status === 'loading') {
    return (
      <Card className="public-slot-picker">
        <p aria-live="polite">A carregar horários…</p>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card className="public-slot-picker">
        <p role="alert" className="form-error">
          {state.message}
        </p>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="public-slot-picker">
        <p>Sem horários disponíveis nos próximos dias. Tente novamente mais tarde.</p>
      </Card>
    );
  }

  const slotDateKeys = new Set(groupsByDateKey.keys());
  const month = buildCalendarMonth(monthKey, slotDateKeys, todayKey);
  const selectedGroup = selectedDateKey ? groupsByDateKey.get(selectedDateKey) : undefined;

  return (
    <Card className="public-slot-picker">
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
          <p className="calendar-month-label">{month.label}</p>
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
          {month.days
            .filter((day) => day.inCurrentMonth)
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
                  aria-pressed={selectedIso === slot.iso}
                  onClick={() => onSelect(slot.iso)}
                >
                  {slot.timeLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

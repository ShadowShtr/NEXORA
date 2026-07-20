'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { getPublicAvailability } from './availability-actions';
import { groupSlotsByDay } from './domain/slot-formatting';
import { buildCalendarMonth, shiftMonthKey } from './domain/month-calendar';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; slotsIso: string[] };

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
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
      <p className="public-step-label">Selecione a data e horário</p>

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

        <div className="calendar-grid calendar-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid" role="grid">
          {month.days.map((day) => {
            const disabled = day.isPast || !day.hasSlots;
            return (
              <button
                key={day.dateKey}
                type="button"
                role="gridcell"
                className="calendar-day"
                data-in-month={day.inCurrentMonth}
                data-has-slots={day.hasSlots}
                aria-selected={selectedDateKey === day.dateKey}
                aria-label={day.dateKey}
                disabled={disabled}
                onClick={() => setPickedDateKey(day.dateKey)}
              >
                {day.dayOfMonth}
              </button>
            );
          })}
        </div>
      </div>

      {selectedGroup ? (
        <div className="calendar-times">
          <p className="calendar-times-label">
            {capitalize(
              formatInTimeZone(selectedGroup.slots[0]!.iso, timezone, "EEEE, dd 'de' MMMM", {
                locale: pt,
              }),
            )}
          </p>
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

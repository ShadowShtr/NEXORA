'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { getPublicAvailability } from './availability-actions';
import { groupSlotsByDay } from './domain/slot-formatting';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; slotsIso: string[] };

// Passo 3 of the public booking flow (NEX-065): fetches real computed slots
// (getPublicAvailability, NEX-062) for the cart's total duration and lets the visitor
// pick one. `reloadKey` lets the parent force a refetch after a SLOT_TAKEN response
// without unmounting this component (which would lose scroll position) — bumping it is
// the same "refresh de slots" the task's acceptance criteria calls for.
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

  if (state.status === 'loading') {
    return (
      <Card>
        <p aria-live="polite">A carregar horários…</p>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card>
        <p role="alert" className="form-error">
          {state.message}
        </p>
      </Card>
    );
  }

  const groups = groupSlotsByDay(state.slotsIso, timezone);

  if (groups.length === 0) {
    return (
      <Card>
        <p>Sem horários disponíveis nos próximos dias. Tente novamente mais tarde.</p>
      </Card>
    );
  }

  return (
    <Card className="public-slot-picker">
      <p className="public-step-label">Passo 3 · Escolha o horário</p>
      <div className="public-slot-days">
        {groups.map((group) => (
          <div key={group.dateKey} className="public-slot-day">
            <p className="public-slot-day-label">{group.dateLabel}</p>
            <ul className="public-slot-list">
              {group.slots.map((slot) => (
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
        ))}
      </div>
    </Card>
  );
}

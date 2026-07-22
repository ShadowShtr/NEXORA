'use client';

import { useId, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import type { FinancePeriodView } from './domain/period';

const OPTIONS: { view: FinancePeriodView; label: string }[] = [
  { view: 'day', label: 'Hoje' },
  { view: 'week', label: 'Esta semana' },
  { view: 'month', label: 'Este mês' },
];

// NEX-131: "Filtros por período... Hoje, semana, mês e personalizado com timezone."
// Period state lives in the URL (?view=&from=&to=), not client component state — same
// convention as the agenda's Dia/Semana/Mês selector (calendar-navigation.ts) — so
// back/forward and bookmarking a specific period both work for free. This component is
// only the trigger + bottom sheet chrome; every option is a plain link or GET form, no
// client-side fetching.
export function FinancePeriodSelector({
  rangeLabel,
  view,
}: {
  rangeLabel: string;
  view: FinancePeriodView;
}) {
  const [open, setOpen] = useState(false);
  const fromId = useId();
  const toId = useId();

  return (
    <div className="finance-period-row">
      <button
        type="button"
        className="finance-period-button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Calendar aria-hidden="true" />
        {rangeLabel}
        <ChevronDown aria-hidden="true" className="finance-period-chevron" />
      </button>
      <button
        type="button"
        className="finance-calendar-button"
        onClick={() => setOpen(true)}
        aria-label="Escolher período"
      >
        <Calendar aria-hidden="true" size={19} />
      </button>

      {open ? (
        <BottomSheet title="Escolher período" onClose={() => setOpen(false)}>
          <div className="period-sheet-options">
            {OPTIONS.map((option) => (
              <a
                key={option.view}
                href={`/dashboard/financeiro?view=${option.view}`}
                className="period-option"
                data-active={option.view === view || undefined}
              >
                {option.label}
              </a>
            ))}
          </div>

          <form action="/dashboard/financeiro" className="period-custom-form">
            <input type="hidden" name="view" value="custom" />
            <p className="period-option" data-active={view === 'custom' || undefined}>
              Personalizado
            </p>
            <div className="period-custom-fields">
              <label className="form-field" htmlFor={fromId}>
                <span className="form-label">De</span>
                <input id={fromId} type="date" name="from" required className="form-input" />
              </label>
              <label className="form-field" htmlFor={toId}>
                <span className="form-label">Até</span>
                <input id={toId} type="date" name="to" required className="form-input" />
              </label>
            </div>
            <Button type="submit" className="period-custom-submit">
              Aplicar
            </Button>
          </form>
        </BottomSheet>
      ) : null}
    </div>
  );
}

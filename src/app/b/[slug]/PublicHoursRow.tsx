'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { TodayHoursSummary, WeeklyHoursLine } from './domain/hours-summary';

// "Ao tocar, abrir um bottom sheet com todos os dias" — the compact "Aberto hoje ·
// 09:00–19:00" summary is a button, not static text, precisely so the full week is one
// tap away rather than a separate page/section.
export function PublicHoursRow({
  summary,
  weeklyLines,
}: {
  summary: TodayHoursSummary;
  weeklyLines: WeeklyHoursLine[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="public-information-row public-information-row-button"
        onClick={() => setOpen(true)}
      >
        <span className="public-information-icon" aria-hidden="true">
          <Clock size={19} />
        </span>
        <span className="public-information-text">
          <span className="public-information-primary" data-status={summary.status}>
            {summary.label}
          </span>
          <span className="public-information-secondary">Ver horário completo</span>
        </span>
      </button>

      {open ? (
        <BottomSheet title="Horário" onClose={() => setOpen(false)}>
          <ul className="public-hours-list">
            {weeklyLines.map((line) => (
              <li key={line.dayLabel} className="public-hours-line">
                <span>{line.dayLabel}</span>
                <span data-closed={line.hoursLabel === 'Fechado' || undefined}>
                  {line.hoursLabel}
                </span>
              </li>
            ))}
          </ul>
        </BottomSheet>
      ) : null}
    </>
  );
}

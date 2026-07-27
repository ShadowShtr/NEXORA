'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import type { ServiceLine } from '@/app/b/[slug]/domain/booking-selection';
import { formatDurationLabel, formatEuros } from '../domain/appointment-wizard';
import type { ClientSelection } from './ClientStep';

// Desktop-only persistent sidebar (CSS-hidden below the 761px breakpoint the rest of
// the dashboard already uses — see globals.css .desktop-nav) — "resumo lateral" from
// the redesign spec, kept as one shared component instead of a second copy of the same
// read-only fields, since it renders the exact same values ServicesStep's mobile sticky
// bar and ConfirmStep's review card already compute from the same lifted state.
export function AppointmentSummaryPanel({
  clientSelection,
  lines,
  totalCents,
  totalMinutes,
  selectedSlotIso,
  timezone,
}: {
  clientSelection: ClientSelection;
  lines: ServiceLine[];
  totalCents: number;
  totalMinutes: number;
  selectedSlotIso: string | null;
  timezone: string;
}) {
  const hasClient = clientSelection.mode !== 'none';

  return (
    <aside className="appointment-summary-panel">
      <p className="text-eyebrow">Nova marcação</p>

      {!hasClient ? (
        <p className="text-support">Selecione uma cliente para começar.</p>
      ) : (
        <>
          <div className="appointment-summary-panel-section">
            <p className="text-eyebrow">Cliente</p>
            <p>
              {clientSelection.mode === 'existing'
                ? clientSelection.client.name
                : clientSelection.name}
            </p>
          </div>

          {lines.length > 0 ? (
            <div className="appointment-summary-panel-section">
              <p className="text-eyebrow">Serviços</p>
              <ul>
                {lines.map((line) => (
                  <li key={line.id}>{line.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {totalMinutes > 0 ? (
            <div className="appointment-summary-panel-section">
              <p className="text-eyebrow">Duração</p>
              <p>{formatDurationLabel(totalMinutes)}</p>
            </div>
          ) : null}

          {selectedSlotIso ? (
            <div className="appointment-summary-panel-section">
              <p className="text-eyebrow">Data</p>
              <p>{formatInTimeZone(selectedSlotIso, timezone, "dd 'de' MMMM", { locale: pt })}</p>
              <p className="text-eyebrow">Horário</p>
              <p>{formatInTimeZone(selectedSlotIso, timezone, 'HH:mm')}</p>
            </div>
          ) : null}

          {totalCents > 0 ? (
            <div className="appointment-summary-panel-total">
              <span>Total</span>
              <span className="appointment-summary-panel-total-value">
                {formatEuros(totalCents)}
              </span>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AppointmentCompletionPanel } from './AppointmentCompletionPanel';
import type { AvailableService } from './domain/extras';

export type CompletionTarget = {
  appointmentId: string;
  clientName: string;
  expectedTotalCents: number;
};

// Visual refinement mid-2026: the completion form lives here, not inline on the agenda
// card — a fixed overlay + sheet sliding up from the bottom, so the timeline behind it
// never changes size or scrolls out of place. data-sheet-open on <body> (not React
// state passed down) is what lets the floating "+" button hide itself via plain CSS
// without the whole agenda page needing to become a client component.
export function CompletionSheet({
  target,
  availableServices,
  onClose,
}: {
  target: CompletionTarget | null;
  availableServices: AvailableService[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    document.body.dataset.sheetOpen = 'true';
    return () => {
      delete document.body.dataset.sheetOpen;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [target, onClose]);

  if (!target) return null;

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="completion-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Concluir atendimento de ${target.clientName}`}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="sheet-title">Concluir atendimento</p>
            <p className="sheet-client-name">{target.clientName}</p>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <AppointmentCompletionPanel
          key={target.appointmentId}
          appointmentId={target.appointmentId}
          expectedTotalCents={target.expectedTotalCents}
          availableServices={availableServices}
          onCompleted={onClose}
          onCancel={onClose}
        />
      </div>
    </>
  );
}

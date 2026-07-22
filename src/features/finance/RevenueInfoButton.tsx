'use client';

import { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

// "Ao tocar no ícone: Total faturado — Soma de todos os atendimentos concluídos no
// período, incluindo valores pagos e pendentes." A toggling popover, not a modal —
// there's nothing to confirm or submit, just one short explanatory sentence.
export function RevenueInfoButton() {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="revenue-info-wrapper">
      <button
        type="button"
        className="revenue-info-button"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        aria-label="O que é o total faturado?"
        onClick={() => setOpen((current) => !current)}
      >
        <HelpCircle aria-hidden="true" size={16} />
      </button>
      {open ? (
        <span role="tooltip" id={popoverId} className="revenue-info-popover">
          Soma de todos os atendimentos concluídos no período, incluindo valores pagos e pendentes.
        </span>
      ) : null}
    </span>
  );
}

'use client';

import { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

// NEX-144: "Explicação sob demanda, sem tour obrigatório." Same toggling-popover shape
// already used by RevenueInfoButton (NEX-130), generalized so any label with a
// technical term can attach one short sentence of help — closed by default, nothing
// forced on the dona, no multi-step tour to build or maintain.
export function HelpTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="help-tip-wrapper">
      <button
        type="button"
        className="help-tip-button"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        aria-label={label}
        onClick={(event) => {
          // Stop the click from bubbling to an ancestor <label>: per spec, a <label>
          // forwards any click that isn't on its own labeled control to that control —
          // without this, tapping "?" next to a <select> would also pop the dropdown.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <HelpCircle aria-hidden="true" size={16} />
      </button>
      {open ? (
        <span role="tooltip" id={popoverId} className="help-tip-popover">
          {text}
        </span>
      ) : null}
    </span>
  );
}

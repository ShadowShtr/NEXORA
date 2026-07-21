'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Generic version of the sheet chrome CompletionSheet.tsx introduced for the agenda
// (overlay + slide-up panel, data-sheet-open on <body> so other islands — the FAB on
// whichever page — can react via plain CSS). Reused by every "form belongs on its own
// screen, not inline in the list" sheet in the Serviços redesign (service editor,
// package editor, category management) rather than duplicating this chrome three times.
export function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    document.body.dataset.sheetOpen = 'true';
    return () => {
      delete document.body.dataset.sheetOpen;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <div>
            <p className="sheet-title">{title}</p>
            {subtitle ? <p className="sheet-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

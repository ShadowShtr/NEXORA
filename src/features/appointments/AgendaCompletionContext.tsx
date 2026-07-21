'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { CompletionSheet, type CompletionTarget } from './CompletionSheet';
import type { AvailableService } from './domain/extras';

const AgendaCompletionContext = createContext<((target: CompletionTarget) => void) | null>(null);

// Agenda timeline rows (AppointmentCard.tsx) call this to open the shared bottom sheet
// instead of each row owning its own completion form — see AgendaCompletionProvider.
export function useOpenCompletionSheet() {
  const openCompletionSheet = useContext(AgendaCompletionContext);
  if (!openCompletionSheet) {
    throw new Error('useOpenCompletionSheet must be used within an AgendaCompletionProvider');
  }
  return openCompletionSheet;
}

// Visual refinement mid-2026: "o fecho do atendimento deve abrir num modal separado,
// nunca expandir a marcação dentro da linha temporal" — a single sheet shared by every
// row on the page (not one completion panel per card) is what makes that possible: the
// timeline stays exactly as tall as its rows regardless of which appointment, if any,
// is being completed.
export function AgendaCompletionProvider({
  availableServices,
  children,
}: {
  availableServices: AvailableService[];
  children: ReactNode;
}) {
  const [target, setTarget] = useState<CompletionTarget | null>(null);

  return (
    <AgendaCompletionContext.Provider value={setTarget}>
      {children}
      <CompletionSheet
        target={target}
        availableServices={availableServices}
        onClose={() => setTarget(null)}
      />
    </AgendaCompletionContext.Provider>
  );
}

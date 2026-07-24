// NEX-121: "Detetar conflitos e alternativas" — acceptance criterion "Lista todas as
// colisões e slots próximos" (EPIC-12.md) / "Conflitos apresentam alternativas para
// escolha manual" (docs/01_PRODUCT_REQUIREMENTS.md §7). Pure function: membership against
// the tenant's own already-computed available-slot set (computeAvailableSlotsMs,
// src/lib/availability-lookup.ts — the same set the single-booking flow and the public
// page already use, so a recurring occurrence is only ever flagged as free/conflicting by
// the exact same definition of "available" the rest of the app relies on).
export type RecurrenceOccurrenceCheck = Readonly<{
  occurrenceMs: number;
  hasConflict: boolean;
  // Nearest free slots to this occurrence, closest first — empty when there's no
  // conflict, or when nothing is free within the available-slots window at all.
  alternativeSlotsMs: readonly number[];
}>;

export function detectRecurrenceConflicts(
  occurrences: readonly number[],
  availableSlotsMs: readonly number[],
  maxAlternatives = 3,
): RecurrenceOccurrenceCheck[] {
  if (!Number.isInteger(maxAlternatives) || maxAlternatives < 1) {
    throw new Error('maxAlternatives must be a positive integer');
  }

  const availableSet = new Set(availableSlotsMs);

  return occurrences.map((occurrenceMs) => {
    const hasConflict = !availableSet.has(occurrenceMs);
    if (!hasConflict) {
      return { occurrenceMs, hasConflict: false, alternativeSlotsMs: [] };
    }

    // Nearest-first by absolute time distance, then re-sorted chronologically — closest
    // in time is the most useful ordering to rank by, but a chronological list reads more
    // naturally once picked out ("escolha manual" is choosing from a short, orderly list).
    const alternativeSlotsMs = [...availableSlotsMs]
      .sort((a, b) => Math.abs(a - occurrenceMs) - Math.abs(b - occurrenceMs))
      .slice(0, maxAlternatives)
      .sort((a, b) => a - b);

    return { occurrenceMs, hasConflict: true, alternativeSlotsMs };
  });
}

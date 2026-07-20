export type ServiceLine = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  photoUrl: string | null;
};

export type PackageOption = ServiceLine & {
  itemNames: string;
  serviceIds: string[];
  compareAtPriceCents: number | null;
};

export type BookingSelection = {
  selectedPackageId: string | null;
  selectedServiceIds: readonly string[];
};

// PRD 01, §4: "A cliente pode combinar pacote com extras, sem duplicação de itens já
// incluídos." A package is single-choice (only one promotional combo makes sense at a
// time); any individually-selected service already covered by it is an "extra" only if
// it isn't already part of the package — this is the one place that dedup has to hold,
// so every other computation (totals, WhatsApp summary) is derived from this list
// instead of re-implementing the exclusion.
export function cartLines(
  selection: BookingSelection,
  services: ReadonlyMap<string, ServiceLine>,
  packages: readonly PackageOption[],
): ServiceLine[] {
  const selectedPackage = packages.find((pkg) => pkg.id === selection.selectedPackageId) ?? null;
  const coveredByPackage = new Set(selectedPackage?.serviceIds ?? []);

  const lines: ServiceLine[] = [];
  if (selectedPackage) lines.push(selectedPackage);

  for (const id of selection.selectedServiceIds) {
    if (coveredByPackage.has(id)) continue;
    const service = services.get(id);
    if (service) lines.push(service);
  }

  return lines;
}

// CLAUDE.md: "Valores monetários são inteiros em cêntimos; nunca use float." Every
// input line already carries integer cents/minutes, and summing integers stays an
// integer — this function is the one place the fixed cart bar (NEX-054) reads its
// running total from, so keeping it float-free here keeps the whole cart float-free.
export function cartTotals(lines: readonly ServiceLine[]): {
  totalCents: number;
  totalMinutes: number;
} {
  return {
    totalCents: lines.reduce((sum, line) => sum + line.priceCents, 0),
    totalMinutes: lines.reduce((sum, line) => sum + line.durationMinutes, 0),
  };
}

export function itemCountLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} itens`;
}

// Extra services that were individually checked before a package was chosen may now be
// covered by it — dropping them from the selection (instead of just excluding them at
// render time) keeps the "extra" checkbox itself from looking checked-but-inert.
export function dropServicesCoveredByPackage(
  selectedServiceIds: readonly string[],
  pkg: PackageOption | null,
): string[] {
  if (!pkg) return [...selectedServiceIds];
  const covered = new Set(pkg.serviceIds);
  return selectedServiceIds.filter((id) => !covered.has(id));
}

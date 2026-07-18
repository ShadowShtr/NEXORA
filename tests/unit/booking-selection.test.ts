import { describe, expect, it } from 'vitest';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  type PackageOption,
  type ServiceLine,
} from '@/app/b/[slug]/domain/booking-selection';

const verniz: ServiceLine = {
  id: 'svc-1',
  name: 'Verniz gel',
  priceCents: 2500,
  durationMinutes: 60,
};
const massagem: ServiceLine = {
  id: 'svc-2',
  name: 'Massagem',
  priceCents: 3000,
  durationMinutes: 45,
};
const pedicure: ServiceLine = {
  id: 'svc-3',
  name: 'Pedicure',
  priceCents: 2000,
  durationMinutes: 40,
};
const services = new Map([
  [verniz.id, verniz],
  [massagem.id, massagem],
  [pedicure.id, pedicure],
]);

const combo: PackageOption = {
  id: 'pkg-1',
  name: 'Combo mãos e pés',
  priceCents: 4000,
  durationMinutes: 100,
  itemNames: 'Verniz gel + Pedicure',
  serviceIds: [verniz.id, pedicure.id],
};

describe('cartLines', () => {
  it('returns nothing when nothing is selected', () => {
    expect(
      cartLines({ selectedPackageId: null, selectedServiceIds: [] }, services, [combo]),
    ).toEqual([]);
  });

  it('includes individually selected services with no package chosen', () => {
    const lines = cartLines(
      { selectedPackageId: null, selectedServiceIds: [verniz.id, massagem.id] },
      services,
      [combo],
    );
    expect(lines).toEqual([verniz, massagem]);
  });

  it('includes the package as its own line when selected', () => {
    const lines = cartLines({ selectedPackageId: combo.id, selectedServiceIds: [] }, services, [
      combo,
    ]);
    expect(lines).toEqual([combo]);
  });

  it('excludes a selected service that the chosen package already covers (no duplication)', () => {
    const lines = cartLines(
      { selectedPackageId: combo.id, selectedServiceIds: [verniz.id] },
      services,
      [combo],
    );
    expect(lines).toEqual([combo]);
  });

  it('still adds a genuine extra alongside the package', () => {
    const lines = cartLines(
      { selectedPackageId: combo.id, selectedServiceIds: [verniz.id, massagem.id] },
      services,
      [combo],
    );
    expect(lines).toEqual([combo, massagem]);
  });

  it('ignores an unknown selectedPackageId as if no package were chosen', () => {
    const lines = cartLines(
      { selectedPackageId: 'nope', selectedServiceIds: [massagem.id] },
      services,
      [combo],
    );
    expect(lines).toEqual([massagem]);
  });
});

describe('cartTotals', () => {
  it('is zero for an empty cart', () => {
    expect(cartTotals([])).toEqual({ totalCents: 0, totalMinutes: 0 });
  });

  it('sums price and duration across lines', () => {
    expect(cartTotals([verniz, massagem])).toEqual({ totalCents: 5500, totalMinutes: 105 });
  });

  it('never double-counts a package plus its own extras once deduped by cartLines', () => {
    const lines = cartLines(
      { selectedPackageId: combo.id, selectedServiceIds: [verniz.id, pedicure.id, massagem.id] },
      services,
      [combo],
    );
    // Only the package (covering verniz+pedicure) plus the genuine extra (massagem).
    expect(cartTotals(lines)).toEqual({
      totalCents: combo.priceCents + massagem.priceCents,
      totalMinutes: combo.durationMinutes + massagem.durationMinutes,
    });
  });
});

describe('dropServicesCoveredByPackage', () => {
  it('returns the same ids unchanged when no package is chosen', () => {
    expect(dropServicesCoveredByPackage([verniz.id, massagem.id], null)).toEqual([
      verniz.id,
      massagem.id,
    ]);
  });

  it('drops ids covered by the package, keeps genuine extras', () => {
    expect(dropServicesCoveredByPackage([verniz.id, massagem.id, pedicure.id], combo)).toEqual([
      massagem.id,
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [verniz.id, massagem.id];
    dropServicesCoveredByPackage(input, combo);
    expect(input).toEqual([verniz.id, massagem.id]);
  });
});

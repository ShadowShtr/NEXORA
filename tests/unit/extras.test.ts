import { describe, expect, it } from 'vitest';
import { extraPriceCents, sumExtrasCents, type Extra } from '@/features/appointments/domain/extras';

describe('extraPriceCents', () => {
  it('reads priceCents from a service extra', () => {
    const extra: Extra = { kind: 'service', serviceId: 's1', name: 'Manicure', priceCents: 1500 };
    expect(extraPriceCents(extra)).toBe(1500);
  });

  it('reads unitPriceCents from a manual extra', () => {
    const extra: Extra = { kind: 'manual', description: 'Verniz extra', unitPriceCents: 500 };
    expect(extraPriceCents(extra)).toBe(500);
  });
});

describe('sumExtrasCents', () => {
  it('sums a mix of service and manual extras', () => {
    const extras: Extra[] = [
      { kind: 'service', serviceId: 's1', name: 'Manicure', priceCents: 1500 },
      { kind: 'manual', description: 'Verniz extra', unitPriceCents: 500 },
      { kind: 'service', serviceId: 's2', name: 'Pedicure', priceCents: 2000 },
    ];
    expect(sumExtrasCents(extras)).toBe(4000);
  });

  it('returns 0 for an empty list', () => {
    expect(sumExtrasCents([])).toBe(0);
  });
});

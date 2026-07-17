import { describe, expect, it } from 'vitest';
import {
  createPackageSchema,
  derivePackageDurationMinutes,
} from '@/features/catalog/domain/package';

const serviceIdA = '11111111-1111-4111-8111-111111111111';
const serviceIdB = '22222222-2222-4222-8222-222222222222';

describe('createPackageSchema', () => {
  it('accepts valid input', () => {
    const result = createPackageSchema.safeParse({
      name: 'Mãos e pés',
      priceEuros: '45,00',
      serviceIds: [serviceIdA, serviceIdB],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priceEuros).toBe(4500);
  });

  it('rejects an empty name', () => {
    const result = createPackageSchema.safeParse({
      name: '',
      priceEuros: '45,00',
      serviceIds: [serviceIdA],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative price', () => {
    const result = createPackageSchema.safeParse({
      name: 'Mãos e pés',
      priceEuros: '-1,00',
      serviceIds: [serviceIdA],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty service list', () => {
    const result = createPackageSchema.safeParse({
      name: 'Mãos e pés',
      priceEuros: '45,00',
      serviceIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid service id', () => {
    const result = createPackageSchema.safeParse({
      name: 'Mãos e pés',
      priceEuros: '45,00',
      serviceIds: ['not-a-uuid'],
    });
    expect(result.success).toBe(false);
  });
});

describe('derivePackageDurationMinutes', () => {
  const servicesById = new Map([
    [serviceIdA, { durationMinutes: 60 }],
    [serviceIdB, { durationMinutes: 30 }],
  ]);

  it('sums the durations of the included services', () => {
    expect(derivePackageDurationMinutes([serviceIdA, serviceIdB], servicesById)).toBe(90);
  });

  it('returns 0 for an empty service list', () => {
    expect(derivePackageDurationMinutes([], servicesById)).toBe(0);
  });

  it('ignores an id missing from the services map instead of throwing', () => {
    expect(derivePackageDurationMinutes([serviceIdA, 'missing'], servicesById)).toBe(60);
  });
});

import { describe, expect, it } from 'vitest';
import { createServiceSchema } from '@/features/catalog/domain/service';

const validCategoryId = '11111111-1111-4111-8111-111111111111';

describe('createServiceSchema', () => {
  it('accepts valid input and converts euros to integer cents', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '25,00',
      durationMinutes: '60',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceEuros).toBe(2500);
      expect(result.data.durationMinutes).toBe(60);
    }
  });

  it('accepts a dot-decimal price too', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '25.50',
      durationMinutes: '60',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priceEuros).toBe(2550);
  });

  it('rejects an empty name', () => {
    const result = createServiceSchema.safeParse({
      name: '',
      priceEuros: '25,00',
      durationMinutes: '60',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative price', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '-5,00',
      durationMinutes: '60',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a garbage price', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: 'grátis',
      durationMinutes: '60',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a duration below 5 minutes', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '25,00',
      durationMinutes: '4',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a duration above 720 minutes', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '25,00',
      durationMinutes: '721',
      categoryId: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it('accepts the duration boundaries (5 and 720)', () => {
    for (const durationMinutes of ['5', '720']) {
      const result = createServiceSchema.safeParse({
        name: 'Verniz gel',
        priceEuros: '25,00',
        durationMinutes,
        categoryId: validCategoryId,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects a non-uuid categoryId', () => {
    const result = createServiceSchema.safeParse({
      name: 'Verniz gel',
      priceEuros: '25,00',
      durationMinutes: '60',
      categoryId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

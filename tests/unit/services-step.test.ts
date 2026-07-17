import { describe, expect, it } from 'vitest';
import { serviceItemSchema } from '@/features/onboarding/domain/services-step';

const validInput = {
  name: 'Verniz gel',
  priceEuros: '25,00',
  durationMinutes: '60',
  categoryName: 'Manicure',
};

describe('serviceItemSchema', () => {
  it('accepts valid input and converts price to cents', () => {
    const result = serviceItemSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceEuros).toBe(2500);
    }
  });

  it('accepts a dot as the decimal separator too', () => {
    const result = serviceItemSchema.safeParse({ ...validInput, priceEuros: '25.50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceEuros).toBe(2550);
    }
  });

  it('rejects an empty name', () => {
    const result = serviceItemSchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative or invalid price', () => {
    expect(serviceItemSchema.safeParse({ ...validInput, priceEuros: '-5' }).success).toBe(false);
    expect(serviceItemSchema.safeParse({ ...validInput, priceEuros: 'free' }).success).toBe(false);
  });

  it('rejects a duration outside the 5-720 minute range', () => {
    expect(serviceItemSchema.safeParse({ ...validInput, durationMinutes: '4' }).success).toBe(
      false,
    );
    expect(serviceItemSchema.safeParse({ ...validInput, durationMinutes: '721' }).success).toBe(
      false,
    );
  });

  it('accepts duration boundaries', () => {
    expect(serviceItemSchema.safeParse({ ...validInput, durationMinutes: '5' }).success).toBe(true);
    expect(serviceItemSchema.safeParse({ ...validInput, durationMinutes: '720' }).success).toBe(
      true,
    );
  });

  it('rejects an empty category', () => {
    const result = serviceItemSchema.safeParse({ ...validInput, categoryName: '' });
    expect(result.success).toBe(false);
  });
});

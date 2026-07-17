import { describe, expect, it } from 'vitest';
import { RECOMMENDED_RULES, rulesStepSchema } from '@/features/onboarding/domain/rules-step';

const validInput = {
  slotIntervalMinutes: RECOMMENDED_RULES.slotIntervalMinutes,
  bufferMinutes: RECOMMENDED_RULES.bufferMinutes,
  minNoticeHours: RECOMMENDED_RULES.minNoticeHours,
  bookingWindowDays: RECOMMENDED_RULES.bookingWindowDays,
  cancellationNoticeHours: RECOMMENDED_RULES.cancellationNoticeHours,
};

describe('rulesStepSchema', () => {
  it('accepts the recommended defaults', () => {
    expect(rulesStepSchema.safeParse(validInput).success).toBe(true);
  });

  it('accepts every allowed value for each field', () => {
    for (const slotIntervalMinutes of [15, 30, 60]) {
      expect(rulesStepSchema.safeParse({ ...validInput, slotIntervalMinutes }).success).toBe(true);
    }
    for (const bufferMinutes of [5, 10, 15, 30]) {
      expect(rulesStepSchema.safeParse({ ...validInput, bufferMinutes }).success).toBe(true);
    }
    for (const minNoticeHours of [1, 2, 3, 6, 12, 24]) {
      expect(rulesStepSchema.safeParse({ ...validInput, minNoticeHours }).success).toBe(true);
    }
    for (const bookingWindowDays of [15, 30, 60, 90, 180]) {
      expect(rulesStepSchema.safeParse({ ...validInput, bookingWindowDays }).success).toBe(true);
    }
    for (const cancellationNoticeHours of [6, 12, 24, 48]) {
      expect(rulesStepSchema.safeParse({ ...validInput, cancellationNoticeHours }).success).toBe(
        true,
      );
    }
  });

  it('rejects a value outside the allowed set, even if numeric', () => {
    expect(rulesStepSchema.safeParse({ ...validInput, slotIntervalMinutes: 45 }).success).toBe(
      false,
    );
    expect(rulesStepSchema.safeParse({ ...validInput, bufferMinutes: 20 }).success).toBe(false);
    expect(rulesStepSchema.safeParse({ ...validInput, minNoticeHours: 5 }).success).toBe(false);
    expect(rulesStepSchema.safeParse({ ...validInput, bookingWindowDays: 45 }).success).toBe(false);
    expect(rulesStepSchema.safeParse({ ...validInput, cancellationNoticeHours: 72 }).success).toBe(
      false,
    );
  });

  it('rejects a non-numeric/garbage value (defends against tampered form submissions)', () => {
    expect(rulesStepSchema.safeParse({ ...validInput, slotIntervalMinutes: 'evil' }).success).toBe(
      false,
    );
  });
});

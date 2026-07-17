import { describe, expect, it } from 'vitest';
import {
  clampStep,
  nextStep,
  previousStep,
  STEP_TITLES,
  TOTAL_STEPS,
} from '@/features/onboarding/domain/wizard';

describe('onboarding wizard step math', () => {
  it('advances by one step', () => {
    expect(nextStep(1)).toBe(2);
    expect(nextStep(4)).toBe(5);
  });

  it('does not advance past the last step', () => {
    expect(nextStep(TOTAL_STEPS)).toBe(TOTAL_STEPS);
  });

  it('retreats by one step', () => {
    expect(previousStep(3)).toBe(2);
  });

  it('does not retreat before the first step', () => {
    expect(previousStep(1)).toBe(1);
  });

  it('clamps arbitrary out-of-range values', () => {
    expect(clampStep(0)).toBe(1);
    expect(clampStep(-5)).toBe(1);
    expect(clampStep(99)).toBe(TOTAL_STEPS);
  });

  it('has one title per step', () => {
    expect(STEP_TITLES).toHaveLength(TOTAL_STEPS);
  });
});

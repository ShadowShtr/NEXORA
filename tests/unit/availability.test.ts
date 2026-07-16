import { describe, expect, it } from 'vitest';
import { generateAvailableSlots } from '@/features/appointments/domain/availability';

const minute = 60_000;

describe('generateAvailableSlots', () => {
  it('excludes slots that overlap an existing appointment', () => {
    const slots = generateAvailableSlots({
      windowStartMs: 0,
      windowEndMs: 240 * minute,
      slotStepMinutes: 30,
      serviceDurationMinutes: 60,
      bufferMinutes: 15,
      busy: [{ startMs: 90 * minute, endMs: 150 * minute }],
    });

    expect(slots).toEqual([0, 150 * minute]);
  });

  it('rejects invalid durations', () => {
    expect(() =>
      generateAvailableSlots({
        windowStartMs: 0,
        windowEndMs: 60 * minute,
        slotStepMinutes: 30,
        serviceDurationMinutes: 0,
        bufferMinutes: 0,
        busy: [],
      }),
    ).toThrow('Service duration must be positive');
  });
});

export type BusyInterval = Readonly<{ startMs: number; endMs: number }>;

export type GenerateSlotsInput = Readonly<{
  windowStartMs: number;
  windowEndMs: number;
  slotStepMinutes: 15 | 30 | 60;
  serviceDurationMinutes: number;
  bufferMinutes: number;
  busy: readonly BusyInterval[];
}>;

export function generateAvailableSlots(input: GenerateSlotsInput): number[] {
  const {
    windowStartMs,
    windowEndMs,
    slotStepMinutes,
    serviceDurationMinutes,
    bufferMinutes,
    busy,
  } = input;

  if (windowEndMs <= windowStartMs) throw new Error('Invalid availability window');
  if (serviceDurationMinutes <= 0) throw new Error('Service duration must be positive');
  if (bufferMinutes < 0) throw new Error('Buffer cannot be negative');

  const stepMs = slotStepMinutes * 60_000;
  const occupiedMs = (serviceDurationMinutes + bufferMinutes) * 60_000;
  const slots: number[] = [];

  for (let start = windowStartMs; start + occupiedMs <= windowEndMs; start += stepMs) {
    const end = start + occupiedMs;
    const overlaps = busy.some((interval) => start < interval.endMs && end > interval.startMs);
    if (!overlaps) slots.push(start);
  }

  return slots;
}

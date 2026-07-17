import { z } from 'zod';

// Allowed option sets and recommended defaults straight from
// docs/01_PRODUCT_REQUIREMENTS.md #5 (Disponibilidade) — these already match the
// business_settings column defaults (0001_initial.sql), applied automatically when
// the row is created (NEX-013), so a fresh tenant already shows the recommendation.
export const SLOT_INTERVAL_OPTIONS = [15, 30, 60] as const;
export const BUFFER_MINUTES_OPTIONS = [5, 10, 15, 30] as const;
export const MIN_NOTICE_HOURS_OPTIONS = [1, 2, 3, 6, 12, 24] as const;
export const BOOKING_WINDOW_DAYS_OPTIONS = [15, 30, 60, 90, 180] as const;
export const CANCELLATION_NOTICE_HOURS_OPTIONS = [6, 12, 24, 48] as const;

export const RECOMMENDED_RULES = {
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 3,
  bookingWindowDays: 60,
  cancellationNoticeHours: 24,
} as const;

function oneOf(options: readonly number[], message: string) {
  return z.coerce
    .number()
    .refine((value) => (options as readonly number[]).includes(value), message);
}

export const rulesStepSchema = z.object({
  slotIntervalMinutes: oneOf(SLOT_INTERVAL_OPTIONS, 'Intervalo da agenda inválido.'),
  bufferMinutes: oneOf(BUFFER_MINUTES_OPTIONS, 'Intervalo entre clientes inválido.'),
  minNoticeHours: oneOf(MIN_NOTICE_HOURS_OPTIONS, 'Antecedência mínima inválida.'),
  bookingWindowDays: oneOf(BOOKING_WINDOW_DAYS_OPTIONS, 'Janela de marcação inválida.'),
  cancellationNoticeHours: oneOf(
    CANCELLATION_NOTICE_HOURS_OPTIONS,
    'Aviso de cancelamento inválido.',
  ),
});

export type RulesStepInput = z.infer<typeof rulesStepSchema>;

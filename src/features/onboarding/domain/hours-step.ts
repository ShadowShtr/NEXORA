import { z } from 'zod';

// JS Date.getDay() convention (0 = Sunday .. 6 = Saturday) — not specified anywhere in
// the product docs, adopted here since availability calculation (NEX-060/061) will
// likely compute this from native Date objects.
export const DAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export type DayHoursValue = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  lunchStartsAt: string;
  lunchEndsAt: string;
};

// "Dias, início/fim e almoço com defaults" (NEX-032): weekdays open with a lunch
// break, Saturday morning only, Sunday closed — a common schedule for an independent
// manicure/pedicure professional.
export const DEFAULT_HOURS: DayHoursValue[] = [
  { dayOfWeek: 0, isOpen: false, opensAt: '', closesAt: '', lunchStartsAt: '', lunchEndsAt: '' },
  {
    dayOfWeek: 1,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 2,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 3,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 4,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 5,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '19:00',
    lunchStartsAt: '13:00',
    lunchEndsAt: '14:00',
  },
  {
    dayOfWeek: 6,
    isOpen: true,
    opensAt: '09:00',
    closesAt: '13:00',
    lunchStartsAt: '',
    lunchEndsAt: '',
  },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayHoursSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    opensAt: z.string(),
    closesAt: z.string(),
    lunchStartsAt: z.string(),
    lunchEndsAt: z.string(),
  })
  .superRefine((day, ctx) => {
    if (!day.isOpen) return;
    const label = DAY_LABELS[day.dayOfWeek];

    const opensValid = TIME_PATTERN.test(day.opensAt);
    const closesValid = TIME_PATTERN.test(day.closesAt);
    if (!opensValid || !closesValid) {
      ctx.addIssue({ code: 'custom', message: `${label}: indique a hora de início e de fim.` });
      return;
    }
    if (day.opensAt >= day.closesAt) {
      ctx.addIssue({
        code: 'custom',
        message: `${label}: a hora de fim deve ser depois da hora de início.`,
      });
    }

    const hasLunchStart = day.lunchStartsAt !== '';
    const hasLunchEnd = day.lunchEndsAt !== '';
    if (hasLunchStart !== hasLunchEnd) {
      ctx.addIssue({
        code: 'custom',
        message: `${label}: indique início e fim do almoço, ou deixe ambos vazios.`,
      });
    } else if (hasLunchStart && hasLunchEnd) {
      if (!TIME_PATTERN.test(day.lunchStartsAt) || !TIME_PATTERN.test(day.lunchEndsAt)) {
        ctx.addIssue({ code: 'custom', message: `${label}: horário de almoço inválido.` });
      } else if (day.lunchStartsAt >= day.lunchEndsAt) {
        ctx.addIssue({
          code: 'custom',
          message: `${label}: o fim do almoço deve ser depois do início.`,
        });
      }
    }
  });

export const hoursStepSchema = z.object({
  days: z.array(dayHoursSchema).length(7),
});

export type HoursStepInput = z.infer<typeof hoursStepSchema>;

type BusinessHoursRow = {
  day_of_week: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  lunch_starts_at: string | null;
  lunch_ends_at: string | null;
};

// Postgres `time` values come back as "HH:MM:SS"; <input type="time"> needs "HH:MM".
export function mergeHoursWithDefaults(rows: BusinessHoursRow[]): DayHoursValue[] {
  const byDay = new Map(rows.map((row) => [row.day_of_week, row]));
  return DEFAULT_HOURS.map((defaultDay) => {
    const row = byDay.get(defaultDay.dayOfWeek);
    if (!row) return defaultDay;
    return {
      dayOfWeek: defaultDay.dayOfWeek,
      isOpen: row.is_open,
      opensAt: row.opens_at?.slice(0, 5) ?? '',
      closesAt: row.closes_at?.slice(0, 5) ?? '',
      lunchStartsAt: row.lunch_starts_at?.slice(0, 5) ?? '',
      lunchEndsAt: row.lunch_ends_at?.slice(0, 5) ?? '',
    };
  });
}

export function parseHoursFormData(formData: FormData): DayHoursValue[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: formData.get(`day-${dayOfWeek}-isOpen`) === 'on',
    opensAt: String(formData.get(`day-${dayOfWeek}-opensAt`) ?? ''),
    closesAt: String(formData.get(`day-${dayOfWeek}-closesAt`) ?? ''),
    lunchStartsAt: String(formData.get(`day-${dayOfWeek}-lunchStartsAt`) ?? ''),
    lunchEndsAt: String(formData.get(`day-${dayOfWeek}-lunchEndsAt`) ?? ''),
  }));
}

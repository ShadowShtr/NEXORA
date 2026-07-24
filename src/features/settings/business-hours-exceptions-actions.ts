'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Mirrors onboarding's own dayHoursSchema validation (features/onboarding/domain/hours-step.ts,
// NEX-031) — same rules, applied to a single date instead of a whole week.
const createSchema = z
  .object({
    exceptionDate: z.string().regex(DATE_PATTERN, 'Data inválida.'),
    isOpen: z.boolean(),
    opensAt: z.string(),
    closesAt: z.string(),
    lunchStartsAt: z.string(),
    lunchEndsAt: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.isOpen) return;

    const opensValid = TIME_PATTERN.test(data.opensAt);
    const closesValid = TIME_PATTERN.test(data.closesAt);
    if (!opensValid || !closesValid) {
      ctx.addIssue({ code: 'custom', message: 'Indique a hora de início e de fim.' });
      return;
    }
    if (data.opensAt >= data.closesAt) {
      ctx.addIssue({ code: 'custom', message: 'A hora de fim deve ser depois da hora de início.' });
    }

    const hasLunchStart = data.lunchStartsAt !== '';
    const hasLunchEnd = data.lunchEndsAt !== '';
    if (hasLunchStart !== hasLunchEnd) {
      ctx.addIssue({
        code: 'custom',
        message: 'Indique início e fim do almoço, ou deixe ambos vazios.',
      });
    } else if (hasLunchStart && hasLunchEnd) {
      if (!TIME_PATTERN.test(data.lunchStartsAt) || !TIME_PATTERN.test(data.lunchEndsAt)) {
        ctx.addIssue({ code: 'custom', message: 'Horário de almoço inválido.' });
      } else if (data.lunchStartsAt >= data.lunchEndsAt) {
        ctx.addIssue({ code: 'custom', message: 'O fim do almoço deve ser depois do início.' });
      }
    }
  });

// NEX-125: "Horários especiais — abrir dia fechado/prolongar e mostrar publicamente."
// business_hours_exceptions (0006_business_hours_exceptions.sql, NEX-060) already models
// this and already takes precedence over business_hours in every availability read
// (resolveDayHours, domain/daily-schedule.ts) — public visibility is automatic, not
// something this action needs to do. This is the first UI to actually write a row.
export async function createBusinessHoursException(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = createSchema.safeParse({
    exceptionDate: formData.get('exceptionDate'),
    isOpen: formData.get('isOpen') === 'true',
    opensAt: formData.get('opensAt') ?? '',
    closesAt: formData.get('closesAt') ?? '',
    lunchStartsAt: formData.get('lunchStartsAt') ?? '',
    lunchEndsAt: formData.get('lunchEndsAt') ?? '',
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from('business_hours_exceptions').insert({
    tenant_id: tenantId,
    exception_date: parsed.data.exceptionDate,
    is_open: parsed.data.isOpen,
    opens_at: parsed.data.isOpen ? parsed.data.opensAt : null,
    closes_at: parsed.data.isOpen ? parsed.data.closesAt : null,
    lunch_starts_at:
      parsed.data.isOpen && parsed.data.lunchStartsAt ? parsed.data.lunchStartsAt : null,
    lunch_ends_at: parsed.data.isOpen && parsed.data.lunchEndsAt ? parsed.data.lunchEndsAt : null,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Já existe um horário especial para esta data.',
        },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}

const deleteSchema = z.object({ id: z.uuid() });

export async function deleteBusinessHoursException(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Horário especial inválido.' },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('business_hours_exceptions')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Este horário especial já não existe.' },
    };
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import {
  allDayBlockRange,
  timedBlockRange,
  weeklyRecurringBlockRanges,
} from '@/features/appointments/domain/availability-blocks';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateField = z.string().regex(DATE_PATTERN, 'Data inválida.');
const timeField = z.string().regex(TIME_PATTERN, 'Hora inválida.');
const reasonField = z.string().trim().max(200).optional();

const createSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pontual'),
    date: dateField,
    startTime: timeField,
    endTime: timeField,
    reason: reasonField,
  }),
  z.object({ kind: z.literal('dia'), date: dateField, reason: reasonField }),
  z.object({
    kind: z.literal('intervalo'),
    startDate: dateField,
    endDate: dateField,
    reason: reasonField,
  }),
  z.object({ kind: z.literal('ferias'), startDate: dateField, endDate: dateField }),
  z.object({
    kind: z.literal('semanal'),
    date: dateField,
    startTime: timeField,
    endTime: timeField,
    occurrenceCount: z.coerce.number().int().min(2).max(52),
    reason: reasonField,
  }),
]);

// NEX-124: "Bloqueios completos — pontual, semanal, dia, intervalo e férias". All five
// kinds funnel through the same table (availability_blocks, already tenant-scoped RLS
// CRUD policies since 0001_initial.sql — no new migration needed) via the pure range
// functions in domain/availability-blocks.ts. "Semanal" is the only kind that writes
// more than one row; a single .insert([...]) call sends every row in one SQL statement,
// atomic without needing a security-definer RPC (no exclusion constraint here to race
// against, unlike appointments).
export async function createAvailabilityBlock(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSchema.safeParse(raw);
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

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  let rows: { starts_at: string; ends_at: string; reason: string | null; is_all_day: boolean }[];
  try {
    switch (parsed.data.kind) {
      case 'pontual': {
        const range = timedBlockRange(
          parsed.data.date,
          parsed.data.startTime,
          parsed.data.endTime,
          timezone,
        );
        rows = [
          {
            starts_at: new Date(range.startsAtMs).toISOString(),
            ends_at: new Date(range.endsAtMs).toISOString(),
            reason: parsed.data.reason ?? null,
            is_all_day: false,
          },
        ];
        break;
      }
      case 'dia': {
        const range = allDayBlockRange(parsed.data.date, parsed.data.date, timezone);
        rows = [
          {
            starts_at: new Date(range.startsAtMs).toISOString(),
            ends_at: new Date(range.endsAtMs).toISOString(),
            reason: parsed.data.reason ?? null,
            is_all_day: true,
          },
        ];
        break;
      }
      case 'intervalo': {
        const range = allDayBlockRange(parsed.data.startDate, parsed.data.endDate, timezone);
        rows = [
          {
            starts_at: new Date(range.startsAtMs).toISOString(),
            ends_at: new Date(range.endsAtMs).toISOString(),
            reason: parsed.data.reason ?? null,
            is_all_day: true,
          },
        ];
        break;
      }
      case 'ferias': {
        const range = allDayBlockRange(parsed.data.startDate, parsed.data.endDate, timezone);
        rows = [
          {
            starts_at: new Date(range.startsAtMs).toISOString(),
            ends_at: new Date(range.endsAtMs).toISOString(),
            reason: 'Férias',
            is_all_day: true,
          },
        ];
        break;
      }
      case 'semanal': {
        const { date, startTime, endTime, occurrenceCount, reason } = parsed.data;
        const ranges = weeklyRecurringBlockRanges(
          date,
          startTime,
          endTime,
          timezone,
          occurrenceCount,
        );
        rows = ranges.map((range) => ({
          starts_at: new Date(range.startsAtMs).toISOString(),
          ends_at: new Date(range.endsAtMs).toISOString(),
          reason: reason ?? null,
          is_all_day: false,
        }));
        break;
      }
    }
  } catch {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Datas/horas inválidas.' } };
  }

  const { error } = await supabase
    .from('availability_blocks')
    .insert(rows.map((row) => ({ ...row, tenant_id: tenantId })));

  if (error) {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível criar o bloqueio. Tente novamente.',
      },
    };
  }

  revalidatePath('/dashboard/definicoes/agenda');
  return { ok: true, value: null };
}

const deleteSchema = z.object({ id: z.uuid() });

export async function deleteAvailabilityBlock(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Bloqueio inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('availability_blocks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Este bloqueio já não existe.' },
    };
  }

  revalidatePath('/dashboard/definicoes/agenda');
  return { ok: true, value: null };
}

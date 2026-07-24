'use client';

import { useActionState, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/Button';
import { createAvailabilityBlock, deleteAvailabilityBlock } from './availability-blocks-actions';
import type { Result } from '@/lib/result';

type BlockKind = 'pontual' | 'dia' | 'intervalo' | 'ferias' | 'semanal';

const KIND_LABELS: Record<BlockKind, string> = {
  pontual: 'Pontual (um período específico)',
  dia: 'Dia inteiro',
  intervalo: 'Intervalo de dias',
  ferias: 'Férias',
  semanal: 'Semanal recorrente',
};

export type AvailabilityBlockRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  isAllDay: boolean;
};

// availability_blocks.ends_at is exclusive (midnight the day AFTER the last blocked
// day for an all-day range) — subtracting a minute before formatting lands back inside
// the actual last blocked calendar day, regardless of that day's DST length.
function formatBlockLabel(block: AvailabilityBlockRow, timezone: string): string {
  if (block.isAllDay) {
    const startLabel = formatInTimeZone(block.startsAt, timezone, 'dd/MM/yyyy');
    const lastDayMs = new Date(block.endsAt).getTime() - 60_000;
    const endLabel = formatInTimeZone(lastDayMs, timezone, 'dd/MM/yyyy');
    return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  }
  const dateLabel = formatInTimeZone(block.startsAt, timezone, 'dd/MM/yyyy');
  const startTime = formatInTimeZone(block.startsAt, timezone, 'HH:mm');
  const endTime = formatInTimeZone(block.endsAt, timezone, 'HH:mm');
  return `${dateLabel}, ${startTime}–${endTime}`;
}

// NEX-124: "Bloqueios completos — pontual, semanal, dia, intervalo e férias". One form,
// a "Tipo" selector that reveals only the fields each kind needs — mirrors the
// recurrence section added to ManualBookingForm (NEX-122) rather than five separate
// forms.
export function AvailabilityBlocksManager({
  blocks,
  timezone,
}: {
  blocks: AvailabilityBlockRow[];
  timezone: string;
}) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createAvailabilityBlock, null);
  const [deleteState, deleteFormAction, deletePending] = useActionState<
    Result<null> | null,
    FormData
  >(deleteAvailabilityBlock, null);
  const [kind, setKind] = useState<BlockKind>('pontual');

  return (
    <div className="stack">
      <form action={createFormAction} className="stack">
        <label>
          Tipo de bloqueio
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as BlockKind)}
          >
            {(Object.keys(KIND_LABELS) as BlockKind[]).map((value) => (
              <option key={value} value={value}>
                {KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {kind === 'pontual' ? (
          <>
            <label>
              Data
              <input type="date" name="date" required />
            </label>
            <label>
              Início
              <input type="time" name="startTime" required />
            </label>
            <label>
              Fim
              <input type="time" name="endTime" required />
            </label>
          </>
        ) : null}

        {kind === 'dia' ? (
          <label>
            Data
            <input type="date" name="date" required />
          </label>
        ) : null}

        {kind === 'intervalo' || kind === 'ferias' ? (
          <>
            <label>
              De
              <input type="date" name="startDate" required />
            </label>
            <label>
              Até
              <input type="date" name="endDate" required />
            </label>
          </>
        ) : null}

        {kind === 'semanal' ? (
          <>
            <label>
              Primeira data
              <input type="date" name="date" required />
            </label>
            <label>
              Início
              <input type="time" name="startTime" required />
            </label>
            <label>
              Fim
              <input type="time" name="endTime" required />
            </label>
            <label>
              Número de semanas
              <input
                type="number"
                name="occurrenceCount"
                min={2}
                max={52}
                defaultValue={4}
                required
              />
            </label>
          </>
        ) : null}

        {kind !== 'ferias' ? (
          <label>
            Motivo (opcional)
            <input type="text" name="reason" maxLength={200} />
          </label>
        ) : null}

        {createState && !createState.ok ? (
          <p role="alert" className="form-error">
            {createState.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={createPending}>
          {createPending ? 'A criar…' : 'Criar bloqueio'}
        </Button>
      </form>

      {deleteState && !deleteState.ok ? (
        <p role="alert" className="form-error">
          {deleteState.error.message}
        </p>
      ) : null}

      {blocks.length === 0 ? (
        <p className="text-support">Sem bloqueios agendados.</p>
      ) : (
        <ul className="stack">
          {blocks.map((block) => (
            <li key={block.id} className="public-service-item">
              <div>
                <span>{formatBlockLabel(block, timezone)}</span>
                {block.reason ? <span className="text-support"> · {block.reason}</span> : null}
              </div>
              <form action={deleteFormAction}>
                <input type="hidden" name="id" value={block.id} />
                <Button type="submit" variant="secondary" disabled={deletePending}>
                  Remover
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

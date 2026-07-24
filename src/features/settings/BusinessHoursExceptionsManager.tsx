'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  createBusinessHoursException,
  deleteBusinessHoursException,
} from './business-hours-exceptions-actions';
import type { Result } from '@/lib/result';

export type BusinessHoursExceptionRow = {
  id: string;
  exceptionDate: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

// NEX-125: "Horários especiais — abrir dia fechado/prolongar." One date, then either
// "Fechado" (overrides an otherwise-open day closed, e.g. a public holiday) or "Aberto"
// with its own hours (opens a normally-closed day, or extends/shortens a normal one) —
// same two-state shape the exceptions table already models, just exposed for the first
// time. "Mostrar publicamente" needs no code here: resolveDayHours already prefers an
// exception over the weekly schedule everywhere availability is computed.
export function BusinessHoursExceptionsManager({
  exceptions,
}: {
  exceptions: BusinessHoursExceptionRow[];
}) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createBusinessHoursException, null);
  const [deleteState, deleteFormAction, deletePending] = useActionState<
    Result<null> | null,
    FormData
  >(deleteBusinessHoursException, null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="stack">
      <form action={createFormAction} className="stack">
        <label>
          Data
          <input type="date" name="exceptionDate" required />
        </label>

        <div className="stack">
          <label>
            <input
              type="radio"
              name="isOpenChoice"
              checked={isOpen}
              onChange={() => setIsOpen(true)}
            />
            Aberto (com horário próprio)
          </label>
          <label>
            <input
              type="radio"
              name="isOpenChoice"
              checked={!isOpen}
              onChange={() => setIsOpen(false)}
            />
            Fechado
          </label>
        </div>
        <input type="hidden" name="isOpen" value={isOpen ? 'true' : 'false'} />

        {isOpen ? (
          <>
            <label>
              Abre às
              <input type="time" name="opensAt" required />
            </label>
            <label>
              Fecha às
              <input type="time" name="closesAt" required />
            </label>
            <label>
              Almoço, início (opcional)
              <input type="time" name="lunchStartsAt" />
            </label>
            <label>
              Almoço, fim (opcional)
              <input type="time" name="lunchEndsAt" />
            </label>
          </>
        ) : null}

        {createState && !createState.ok ? (
          <p role="alert" className="form-error">
            {createState.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={createPending}>
          {createPending ? 'A guardar…' : 'Adicionar horário especial'}
        </Button>
      </form>

      {deleteState && !deleteState.ok ? (
        <p role="alert" className="form-error">
          {deleteState.error.message}
        </p>
      ) : null}

      {exceptions.length === 0 ? (
        <p className="text-support">Sem horários especiais agendados.</p>
      ) : (
        <ul className="stack">
          {exceptions.map((exception) => (
            <li key={exception.id} className="public-service-item">
              <span>
                {formatDate(exception.exceptionDate)} —{' '}
                {exception.isOpen
                  ? `${exception.opensAt?.slice(0, 5)}–${exception.closesAt?.slice(0, 5)}`
                  : 'Fechado'}
              </span>
              <form action={deleteFormAction}>
                <input type="hidden" name="id" value={exception.id} />
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

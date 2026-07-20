'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PreRegistrationStep } from '../PreRegistrationStep';
import { useBookingSession } from '../useBookingSession';
import type { ClientContactInput } from '@/lib/validation/client';

// Visual refinement mid-2026: step 3 of the paginated public flow — requires a slot
// already chosen (redirects back to /horario otherwise, same guard pattern as
// HorarioClient redirecting to /servicos).
export function DadosClient({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const router = useRouter();
  const { state, ready, persist } = useBookingSession(tenantId, tenantSlug);
  const [pending, setPending] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!state.selectedSlotIso) {
      router.replace(`/b/${tenantSlug}/horario`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function handleComplete(registration: ClientContactInput) {
    setPending(true);
    setContinueError(null);
    try {
      const result = await persist({ ...state, registration });
      if (!result.ok) {
        setContinueError(result.error.message);
        setPending(false);
        return;
      }
      router.push(`/b/${tenantSlug}/resumo`);
    } catch {
      setContinueError('Não foi possível continuar. Tente novamente.');
      setPending(false);
    }
  }

  if (!ready || !state.selectedSlotIso) return null;

  return (
    <div className="public-booking-content">
      <header className="public-step-header">
        <Link href={`/b/${tenantSlug}/horario`} className="nx-icon-button" aria-label="Voltar">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <h1 className="text-title">Os seus dados</h1>
      </header>

      <div className="card">
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <PreRegistrationStep
            onComplete={(registration) => void handleComplete(registration)}
            embedded
          />
        </fieldset>
        {continueError ? (
          <p role="alert" className="form-error">
            {continueError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

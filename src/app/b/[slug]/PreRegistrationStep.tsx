'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clientContactSchema, type ClientContactInput } from '@/lib/validation/client';

// Nothing here is ever sent to the server — this is client-side-only state, held in
// memory until the client reaches "Confirmar" (still just a WhatsApp handoff, no
// booking engine yet). Abandoning at this step, or anywhere after it, leaves the
// `clients` table completely untouched (NEX-051: "nada em clients antes do booking").
//
// `embedded`: when this step now runs after service/slot selection instead of gating
// the whole page (visual refinement, mid-2026), the parent already renders its own
// Card + "Passo 3" label around this form — embedded skips duplicating both.
export function PreRegistrationStep({
  onComplete,
  embedded = false,
}: {
  onComplete: (registration: ClientContactInput) => void;
  embedded?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const parsed = clientContactSchema.safeParse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Verifique os dados introduzidos.');
      return;
    }
    setError(null);
    onComplete(parsed.data);
  }

  const form = (
    <form className="stack" aria-label="Os seus dados" action={handleSubmit}>
      <label>
        O seu nome
        <input name="name" required maxLength={120} />
      </label>
      <label>
        Telemóvel
        <input name="phone" type="tel" required autoComplete="tel" />
      </label>
      <label>
        E-mail (opcional)
        <input name="email" type="text" inputMode="email" autoComplete="email" />
      </label>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <Button type="submit">Continuar</Button>
    </form>
  );

  if (embedded) return form;

  return (
    <Card>
      <p className="public-step-label">Passo 1 · Os seus dados</p>
      {form}
    </Card>
  );
}

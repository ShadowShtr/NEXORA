'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { submitBusinessStep } from '@/features/onboarding/actions';
import type { Result } from '@/lib/result';

type BusinessStepProps = {
  initialValues: {
    professionalName: string;
    phone: string;
    email: string;
    addressLine: string;
    postalCode: string;
    locality: string;
    mapsUrl: string;
  };
};

export function BusinessStep({ initialValues }: BusinessStepProps) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    submitBusinessStep,
    null,
  );

  return (
    <form className="stack" aria-label="Negócio e morada" action={formAction}>
      <label>
        O seu nome
        <input
          name="professionalName"
          defaultValue={initialValues.professionalName}
          required
          minLength={2}
        />
      </label>
      <label>
        Telemóvel
        <input
          name="phone"
          type="tel"
          defaultValue={initialValues.phone}
          required
          autoComplete="tel"
        />
      </label>
      <label>
        E-mail (opcional)
        <input name="email" type="email" defaultValue={initialValues.email} autoComplete="email" />
      </label>
      <label>
        Morada
        <input name="addressLine" defaultValue={initialValues.addressLine} required />
      </label>
      <label>
        Código postal
        <input name="postalCode" defaultValue={initialValues.postalCode} required />
      </label>
      <label>
        Localidade
        <input name="locality" defaultValue={initialValues.locality} required />
      </label>
      <label>
        Link do Google Maps (opcional)
        <input
          name="mapsUrl"
          type="url"
          defaultValue={initialValues.mapsUrl}
          placeholder="https://maps.google.com/..."
        />
      </label>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <div className="wizard-actions">
        <span />
        <Button type="submit" disabled={pending}>
          {pending ? 'A guardar…' : 'Seguinte'}
        </Button>
      </div>
    </form>
  );
}

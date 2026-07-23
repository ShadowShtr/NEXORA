'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { updatePublicProfile } from './public-profile-actions';
import type { Result } from '@/lib/result';

// Visual refinement — página pública inicial (/b/[slug]): specialty/about/Instagram/
// booking toggle configured here feed directly into that page, hidden there when
// empty (never a placeholder) — same "sem informações vazias" rule the reference
// itself calls out.
export function PublicProfileForm({
  specialty,
  aboutDescription,
  instagramHandle,
  bookingEnabled,
}: {
  specialty: string | null;
  aboutDescription: string | null;
  instagramHandle: string | null;
  bookingEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updatePublicProfile,
    null,
  );

  return (
    <form action={formAction} className="stack">
      <label>
        Especialidade
        <input
          type="text"
          name="specialty"
          maxLength={80}
          defaultValue={specialty ?? ''}
          placeholder="Ex.: Manicure e Nail Art"
        />
      </label>
      <label>
        Sobre o seu negócio
        <textarea
          name="aboutDescription"
          maxLength={600}
          rows={4}
          defaultValue={aboutDescription ?? ''}
          placeholder="Uma breve apresentação para quem visita a sua página pública."
        />
      </label>
      <label>
        Instagram
        <input
          type="text"
          name="instagramHandle"
          maxLength={31}
          defaultValue={instagramHandle ?? ''}
          placeholder="ana.nails.studio"
        />
      </label>
      <p className="text-support">
        Sem o símbolo @ — só o identificador (ex.: para instagram.com/ana.nails, escreva
        &quot;ana.nails&quot;).
      </p>
      <label className="checkbox-field">
        <input type="checkbox" name="bookingEnabled" defaultChecked={bookingEnabled} />
        Aceitar marcações online
      </label>
      <p className="text-support">
        Quando desligado, a sua página pública mantém morada, contacto e horário visíveis, mas o
        botão principal passa a &quot;Contactar profissional&quot; em vez de abrir o fluxo de
        marcação.
      </p>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {state?.ok ? <p role="status">Perfil público guardado.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar perfil público'}
      </Button>
    </form>
  );
}

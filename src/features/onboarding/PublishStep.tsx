'use client';

import { useActionState, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { goToPreviousStep, submitPublishStep } from '@/features/onboarding/actions';
import {
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  normalizeSlug,
  publicBookingUrl,
} from '@/features/onboarding/domain/publish-step';
import type { Result } from '@/lib/result';

type PublishStepProps = {
  initialSlug: string;
  appUrl: string;
};

export function PublishStep({ initialSlug, appUrl }: PublishStepProps) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    submitPublishStep,
    null,
  );
  const [slug, setSlug] = useState(initialSlug);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const previewUrl = publicBookingUrl(appUrl, slug || '…');

  // QR generated locally with the `qrcode` library (pure computation, no network
  // request to a third-party QR service) — matches the "QR local" acceptance criterion.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    QRCode.toDataURL(publicBookingUrl(appUrl, slug), { margin: 1, width: 220 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appUrl, slug]);

  return (
    <form className="stack" aria-label="Publicar link e QR Code" action={formAction}>
      <label>
        Link de marcação
        <input
          name="slug"
          defaultValue={initialSlug}
          minLength={SLUG_MIN_LENGTH}
          maxLength={SLUG_MAX_LENGTH}
          required
          onChange={(event) => setSlug(normalizeSlug(event.target.value))}
          onBlur={(event) => {
            const normalized = normalizeSlug(event.target.value);
            event.target.value = normalized;
            setSlug(normalized);
          }}
        />
      </label>
      <p className="publish-preview">
        O seu link público: <strong>{previewUrl}</strong>
      </p>

      {slug && qrDataUrl ? (
        // Locally generated data URL (qrcode lib), not a static/remote asset next/image can optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="publish-qr"
          src={qrDataUrl}
          alt={`Código QR para ${previewUrl}`}
          width={220}
          height={220}
        />
      ) : null}

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      <div className="wizard-actions">
        <Button type="submit" formAction={goToPreviousStep} disabled={pending}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'A publicar…' : 'Publicar'}
        </Button>
      </div>
    </form>
  );
}

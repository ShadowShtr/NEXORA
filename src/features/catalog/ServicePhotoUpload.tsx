'use client';

import { useActionState } from 'react';
import { ImagePlus } from 'lucide-react';
import { removeServicePhoto, uploadServicePhoto } from './photo-actions';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 — Serviços reference: replaces the raw "Escolher
// ficheiro / nenhum selecionado" <input type=file> look with a visual drop-zone. Still
// a native <label>+<input type=file> underneath (a label wraps its input, so clicking
// anywhere on the dashed area opens the file picker with no ref/onClick choreography
// needed) submitting to the same uploadServicePhoto/removeServicePhoto actions
// ServicesManager already used — only the presentation changed.
export function ServicePhotoUpload({
  serviceId,
  photoUrl,
}: {
  serviceId: string;
  photoUrl: string | null;
}) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState<
    Result<null> | null,
    FormData
  >(uploadServicePhoto, null);
  const [removeState, removeFormAction, removePending] = useActionState<
    Result<null> | null,
    FormData
  >(removeServicePhoto, null);

  const error = [uploadState, removeState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <div className="service-photo-field">
      {photoUrl ? (
        <div className="service-photo-preview-wrapper">
          {/* Public bucket URL, not an asset next/image needs to sign or refresh. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="service-photo-preview" />
          <div className="service-photo-preview-actions">
            <form action={uploadFormAction}>
              <input type="hidden" name="serviceId" value={serviceId} />
              <label className="service-photo-replace-button">
                {uploadPending ? 'A enviar…' : 'Trocar'}
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                />
              </label>
            </form>
            <form action={removeFormAction}>
              <input type="hidden" name="serviceId" value={serviceId} />
              <button
                type="submit"
                className="service-photo-remove-button"
                disabled={removePending}
              >
                {removePending ? 'A remover…' : 'Remover'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form action={uploadFormAction}>
          <input type="hidden" name="serviceId" value={serviceId} />
          <label className="service-photo-upload">
            <ImagePlus aria-hidden="true" />
            <span className="service-photo-upload-text">
              {uploadPending ? 'A enviar…' : 'Adicionar fotografia'}
            </span>
            <span className="service-photo-upload-hint">PNG ou JPG até 5 MB</span>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            />
          </label>
        </form>
      )}
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}
    </div>
  );
}

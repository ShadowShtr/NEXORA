'use client';

import { useActionState, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Result } from '@/lib/result';

type ImageAction = (prevState: Result<null> | null, formData: FormData) => Promise<Result<null>>;

// Same drop-zone + preview + Trocar/Remover convention as ServicePhotoUpload.tsx
// (src/features/catalog/ServicePhotoUpload.tsx) — a native <label> wrapping
// <input type=file>, auto-submitting on change, so clicking anywhere in the dashed
// area opens the file picker with no ref/onClick choreography. variant only changes
// the CSS class (circular logo vs. wide banner cover preview); the upload/remove flow
// is identical either way.
export function BusinessImageUpload({
  variant,
  imageUrl,
  uploadAction,
  removeAction,
  label,
  hint,
}: {
  variant: 'logo' | 'cover';
  imageUrl: string | null;
  uploadAction: ImageAction;
  removeAction: ImageAction;
  label: string;
  hint: string;
}) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState<
    Result<null> | null,
    FormData
  >(uploadAction, null);
  const [removeState, removeFormAction, removePending] = useActionState<
    Result<null> | null,
    FormData
  >(removeAction, null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const error = [uploadState, removeState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <div className={`business-image-field business-image-field-${variant}`}>
      <p className="business-image-label">{label}</p>
      {imageUrl ? (
        <div className="business-image-preview-wrapper">
          {/* Public bucket URL, not an asset next/image needs to sign or refresh. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className={`business-image-preview business-image-preview-${variant}`}
          />
          <div className="business-image-preview-actions">
            <form action={uploadFormAction}>
              <label className="business-image-replace-button">
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
            {confirmingRemove ? (
              <form action={removeFormAction} className="business-image-remove-confirm">
                <span className="text-support">Remover esta imagem?</span>
                <button
                  type="submit"
                  className="business-image-remove-button"
                  disabled={removePending}
                >
                  {removePending ? 'A remover…' : 'Sim, remover'}
                </button>
                <button
                  type="button"
                  className="business-image-replace-button"
                  onClick={() => setConfirmingRemove(false)}
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="business-image-remove-button"
                onClick={() => setConfirmingRemove(true)}
              >
                Remover
              </button>
            )}
          </div>
        </div>
      ) : (
        <form action={uploadFormAction}>
          <label className={`business-image-upload business-image-upload-${variant}`}>
            <ImagePlus aria-hidden="true" />
            <span className="business-image-upload-text">
              {uploadPending ? 'A enviar…' : 'Adicionar imagem'}
            </span>
            <span className="business-image-upload-hint">{hint}</span>
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

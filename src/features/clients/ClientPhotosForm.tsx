'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteClientPhoto, uploadClientPhoto } from './photo-actions';
import {
  CLIENT_PHOTO_KIND_LABELS,
  CLIENT_PHOTO_KINDS,
  type ClientPhotoKind,
} from './domain/photos';
import type { Result } from '@/lib/result';

export type ClientPhotoItem = {
  id: string;
  kind: ClientPhotoKind;
  signedUrl: string | null;
};

function PhotoThumbnail({ clientId, photo }: { clientId: string; photo: ClientPhotoItem }) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    deleteClientPhoto,
    null,
  );

  return (
    <li className="client-photo-item">
      {photo.signedUrl ? (
        // Short-lived signed URL (private bucket) — not an asset next/image can cache/optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="client-photo-thumb" src={photo.signedUrl} alt="" />
      ) : (
        <div className="client-photo-thumb client-photo-thumb-error" aria-hidden="true" />
      )}
      <p className="text-meta">{CLIENT_PHOTO_KIND_LABELS[photo.kind]}</p>
      <form action={formAction}>
        <input type="hidden" name="photoId" value={photo.id} />
        <input type="hidden" name="clientId" value={clientId} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'A apagar…' : 'Apagar'}
        </Button>
      </form>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
    </li>
  );
}

// NEX-094: "Fotografias internas dos trabalhos" (docs/01_PRODUCT_REQUIREMENTS.md §10) —
// never a public portfolio (same doc, "Não existe portefólio público no MVP"), so this
// only ever renders inside the authenticated dashboard. Upload strips EXIF and re-encodes
// server-side (src/lib/image-processing.ts); this component only handles the form/gallery.
export function ClientPhotosForm({
  clientId,
  photos,
}: {
  clientId: string;
  photos: ClientPhotoItem[];
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    uploadClientPhoto,
    null,
  );
  const [formKey, setFormKey] = useState(0);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }

  return (
    <div className="stack">
      {photos.length > 0 ? (
        <ul className="client-photo-list">
          {photos.map((photo) => (
            <PhotoThumbnail key={photo.id} clientId={clientId} photo={photo} />
          ))}
        </ul>
      ) : (
        <p className="text-support">Ainda não tem fotografias desta cliente.</p>
      )}

      <form key={formKey} action={formAction} className="stack" aria-label="Adicionar fotografia">
        <input type="hidden" name="clientId" value={clientId} />
        <label>
          Fotografia
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <label>
          Tipo
          <select name="kind" defaultValue="other">
            {CLIENT_PHOTO_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {CLIENT_PHOTO_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        {state && !state.ok ? (
          <p role="alert" className="form-error">
            {state.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'A enviar…' : 'Adicionar fotografia'}
        </Button>
      </form>
    </div>
  );
}

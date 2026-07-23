'use client';

import { useEffect } from 'react';

// Distinct from not-found.tsx on purpose: a thrown error here means loadPublicProfile
// hit a genuine query failure (loadPublicProfile in page.tsx throws rather than
// swallowing tenantError/settingsError into the same "página não disponível" the
// not-found boundary shows for a real absent/unpublished tenant) — telling a visitor
// "esta página não existe" for what is actually an outage or a pending migration would
// hide the real problem instead of surfacing it.
export default function PublicBusinessError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="public-profile-page">
      <div className="public-unavailable-state">
        <p className="public-unavailable-title">
          Não foi possível carregar esta página agora. Tente novamente dentro de momentos.
        </p>
        <button type="button" className="button link-button" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

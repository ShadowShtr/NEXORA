'use client';

import { useState } from 'react';

// "Limitar inicialmente a quatro linhas... quando o texto for maior, mostrar 'Ler
// mais'" — the clamp is pure CSS (line-clamp), this only tracks whether the reader
// asked to see the rest; there's no measurement/overflow-detection needed because
// showing "Ler mais" on a description that happens to fit in 4 lines anyway is
// harmless (clicking it just reveals nothing new).
export function PublicAboutSection({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="public-about-section">
      <p className="public-section-title">Sobre</p>
      <div className="public-about-card">
        <p className={expanded ? undefined : 'public-about-text'}>{description}</p>
        {!expanded ? (
          <button type="button" className="public-about-more" onClick={() => setExpanded(true)}>
            Ler mais
          </button>
        ) : null}
      </div>
    </section>
  );
}

import Link from 'next/link';

// Reference #26 "Página indisponível" — also the boundary Next.js renders for any
// notFound() call in this segment (unknown slug, suspended tenant, never-published
// tenant — see page.tsx). No "Contactar a NEXORA" action: there is no real support
// channel anywhere in this app yet (CLAUDE.md: não inventar destino sem existir) — only
// a link with a genuine destination.
export default function PublicBusinessNotFound() {
  return (
    <div className="public-profile-page">
      <div className="public-unavailable-state">
        <p className="public-unavailable-title">Esta página de marcações não está disponível.</p>
        <Link href="/" className="button link-button">
          Voltar
        </Link>
      </div>
    </div>
  );
}

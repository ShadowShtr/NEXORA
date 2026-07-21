import { ChevronRight } from 'lucide-react';
import { initials } from '@/lib/initials';

// Visual refinement mid-2026 — Mais reference: no owner/profile photo concept exists
// anywhere in this schema (profiles has no avatar column, unlike client_photos or
// service photo_path, both different concepts) — initials-on-soft-background is the
// same real fallback ClientCard.tsx already uses, not a placeholder standing in for a
// missing feature. "Proprietária" is a static, accurate descriptor for this MVP (no
// teams/roles UI per CLAUDE.md), not a fabricated dynamic field.
export function ProfileSummaryCard({
  displayName,
  publicUrl,
}: {
  displayName: string;
  publicUrl: string | null;
}) {
  return (
    <div className="profile-summary-card">
      <span className="profile-summary-avatar" aria-hidden="true">
        {initials(displayName || '?')}
      </span>
      <span className="profile-summary-main">
        <span className="profile-summary-name">{displayName || 'Profissional'}</span>
        <span className="profile-summary-role">Proprietária</span>
        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="profile-public-link">
            Ver perfil público
          </a>
        ) : null}
      </span>
      {publicUrl ? (
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="profile-summary-chevron"
          aria-label="Ver perfil público"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </a>
      ) : (
        <span className="profile-summary-chevron" aria-hidden="true">
          <ChevronRight size={20} />
        </span>
      )}
    </div>
  );
}

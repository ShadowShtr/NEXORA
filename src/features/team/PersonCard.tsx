import { ChevronRight } from 'lucide-react';
import { initials } from '@/lib/initials';
import type { TenantRole } from '@/lib/auth/permissions';
import type { TeamMemberListItem } from './queries';

const ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Dona',
  manager: 'Gestora',
  receptionist: 'Rececionista',
  provider: 'Prestadora',
  viewer: 'Visualizadora',
};

// NEX-217: card de pessoa, 88–104px de altura, sem e-mail completo (o plano mestre
// pede explicitamente para não mostrar e-mail no card principal — só nome, role,
// indicador de prestador, nº de serviços e estado).
export function PersonCard({
  member,
  onSelect,
}: {
  member: TeamMemberListItem;
  onSelect: () => void;
}) {
  return (
    <li className="team-person-card-item">
      <button type="button" className="team-person-card" onClick={onSelect}>
        <span className="team-person-avatar" aria-hidden="true">
          {initials(member.displayName)}
        </span>
        <span className="team-person-main-info">
          <span className="team-person-name-row">
            <span className="team-person-name">{member.displayName}</span>
            {!member.isActive ? (
              <span className="team-badge team-badge-inactive">Inativa</span>
            ) : null}
          </span>
          <span className="team-person-meta">
            {ROLE_LABELS[member.role]}
            {member.isProvider ? ' · Prestadora' : ''}
            {member.isProvider ? ` · ${member.serviceCount} serviço(s)` : ''}
          </span>
        </span>
        <span className="team-person-chevron">
          <ChevronRight aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}

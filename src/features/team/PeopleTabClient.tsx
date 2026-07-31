'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PersonCard } from './PersonCard';
import { PersonEditorWizard } from './PersonEditorWizard';
import type { PendingInviteListItem, ServiceOption, TeamMemberListItem } from './queries';

type MemberFilter = 'all' | 'providers' | 'management' | 'inactive';

const FILTERS: { value: MemberFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'providers', label: 'Prestadores' },
  { value: 'management', label: 'Gestão' },
  { value: 'inactive', label: 'Inativos' },
];

function matchesFilter(member: TeamMemberListItem, filter: MemberFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'providers') return member.isProvider;
  if (filter === 'management') return member.role === 'owner' || member.role === 'manager';
  return !member.isActive;
}

export function PeopleTabClient({
  members,
  pendingInvites,
  serviceOptions,
  providerServiceIdsByProviderId,
}: {
  members: TeamMemberListItem[];
  pendingInvites: PendingInviteListItem[];
  serviceOptions: ServiceOption[];
  providerServiceIdsByProviderId: Record<string, string[]>;
}) {
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [editingMember, setEditingMember] = useState<TeamMemberListItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const filteredMembers = members.filter((member) => matchesFilter(member, filter));
  const isEmptyTenant = members.length <= 1 && pendingInvites.length === 0;

  return (
    <div className="team-tab-panel">
      <div className="clients-filter-chips">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="filter-chip"
            data-active={filter === option.value || undefined}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isEmptyTenant ? (
        <div className="clients-empty-state">
          <p className="more-title team-empty-title">Ainda trabalha apenas consigo?</p>
          <p className="text-support">
            Quando adicionar uma pessoa, poderá definir serviços, horários e acesso ao sistema.
          </p>
          <Button onClick={() => setIsAddingNew(true)}>
            <UserPlus aria-hidden="true" size={18} />
            Adicionar primeira pessoa
          </Button>
        </div>
      ) : (
        <>
          <ul className="team-person-cards-list">
            {filteredMembers.map((member) => (
              <PersonCard
                key={member.userId}
                member={member}
                onSelect={() => setEditingMember(member)}
              />
            ))}
          </ul>
          {pendingInvites.length > 0 ? (
            <div className="team-pending-invites">
              <p className="text-eyebrow">Convites pendentes</p>
              <ul className="team-pending-invites-list">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="team-pending-invite-row">
                    <span>{invite.name}</span>
                    <span className="team-person-meta">
                      Expira em {new Date(invite.expiresAt).toLocaleDateString('pt-PT')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {!isEmptyTenant ? (
        <Button className="team-add-button" onClick={() => setIsAddingNew(true)}>
          <UserPlus aria-hidden="true" size={18} />
          Adicionar
        </Button>
      ) : null}

      {isAddingNew ? (
        <PersonEditorWizard
          member={null}
          serviceOptions={serviceOptions}
          initialProviderServiceIds={[]}
          onClose={() => setIsAddingNew(false)}
        />
      ) : null}

      {editingMember ? (
        <PersonEditorWizard
          member={editingMember}
          serviceOptions={serviceOptions}
          initialProviderServiceIds={
            editingMember.providerId
              ? (providerServiceIdsByProviderId[editingMember.providerId] ?? [])
              : []
          }
          onClose={() => setEditingMember(null)}
        />
      ) : null}
    </div>
  );
}

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { hasPermission, type TenantRole } from '@/lib/auth/permissions';
import {
  listActiveServiceOptions,
  listPendingInvites,
  listProviderServiceIds,
  listResourceServiceIds,
  listResources,
  listTeamMembers,
} from '@/features/team/queries';
import { PeopleTabClient } from '@/features/team/PeopleTabClient';
import { ResourcesTabClient } from '@/features/team/ResourcesTabClient';
import { PermissionsTab } from '@/features/team/PermissionsTab';

type TeamTab = 'pessoas' | 'recursos' | 'permissoes';

function isTeamTab(value: string | undefined): value is TeamTab {
  return value === 'pessoas' || value === 'recursos' || value === 'permissoes';
}

// NEX-217: "Mais → Gestão → Equipa e recursos" (mobile) / "Sidebar → Gestão → Equipa e
// recursos" (desktop). Gate próprio (para além de requireProfile()): só quem tem
// manage_team (docs/PERMISSION_MATRIX.md, NEX-211) pode sequer abrir esta página — as
// Server Actions em member-actions.ts/resource-actions.ts já repetem o mesmo gate no
// limite da escrita, mas aqui evita mostrar dados de equipa a quem não devia vê-los.
export default async function EquipaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantId, role } = await requireProfile();
  const params = await searchParams;
  const tab: TeamTab = isTeamTab(params.tab) ? params.tab : 'pessoas';

  if (!hasPermission(role as TenantRole, 'manage_team')) {
    return (
      <div className="shell">
        <div className="finance-title-row">
          <Link href="/dashboard/mais" className="finance-back-button" aria-label="Voltar a Mais">
            <ChevronLeft aria-hidden="true" size={20} />
          </Link>
          <h1 className="more-title">Equipa e recursos</h1>
        </div>
        <p className="text-support">Sem permissão para gerir a equipa.</p>
      </div>
    );
  }

  const [members, pendingInvites, resources, serviceOptions] = await Promise.all([
    listTeamMembers(tenantId),
    listPendingInvites(tenantId),
    listResources(tenantId),
    listActiveServiceOptions(tenantId),
  ]);

  const providerIds = members.filter((m) => m.providerId).map((m) => m.providerId as string);
  const resourceIds = resources.map((r) => r.id);

  const [providerServiceIdsEntries, resourceServiceIdsEntries] = await Promise.all([
    Promise.all(
      providerIds.map(
        async (providerId) => [providerId, await listProviderServiceIds(providerId)] as const,
      ),
    ),
    Promise.all(
      resourceIds.map(
        async (resourceId) => [resourceId, await listResourceServiceIds(resourceId)] as const,
      ),
    ),
  ]);

  const providerServiceIdsByProviderId = Object.fromEntries(providerServiceIdsEntries);
  const resourceServiceIdsByResourceId = Object.fromEntries(resourceServiceIdsEntries);

  function tabHref(target: TeamTab) {
    return `/dashboard/equipa?tab=${target}`;
  }

  return (
    <div className="shell team-page">
      <div className="finance-title-row">
        <Link href="/dashboard/mais" className="finance-back-button" aria-label="Voltar a Mais">
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <div>
          <h1 className="more-title">Equipa e recursos</h1>
          <p className="text-support">Pessoas, salas e permissões deste negócio.</p>
        </div>
      </div>

      <div className="nx-tabs nx-tabs-pill" role="tablist">
        <a
          href={tabHref('pessoas')}
          role="tab"
          className="nx-tab"
          aria-current={tab === 'pessoas' ? 'page' : undefined}
        >
          Pessoas
        </a>
        <a
          href={tabHref('recursos')}
          role="tab"
          className="nx-tab"
          aria-current={tab === 'recursos' ? 'page' : undefined}
        >
          Salas e equipamentos
        </a>
        <a
          href={tabHref('permissoes')}
          role="tab"
          className="nx-tab"
          aria-current={tab === 'permissoes' ? 'page' : undefined}
        >
          Permissões
        </a>
      </div>

      {tab === 'pessoas' ? (
        <PeopleTabClient
          members={members}
          pendingInvites={pendingInvites}
          serviceOptions={serviceOptions}
          providerServiceIdsByProviderId={providerServiceIdsByProviderId}
        />
      ) : null}
      {tab === 'recursos' ? (
        <ResourcesTabClient
          resources={resources}
          serviceOptions={serviceOptions}
          resourceServiceIdsByResourceId={resourceServiceIdsByResourceId}
        />
      ) : null}
      {tab === 'permissoes' ? <PermissionsTab /> : null}
    </div>
  );
}

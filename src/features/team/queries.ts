import { createClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/auth/permissions';

export type TeamMemberListItem = {
  userId: string;
  displayName: string;
  role: TenantRole;
  isActive: boolean;
  isProvider: boolean;
  providerId: string | null;
  providerStatus: 'active' | 'inactive' | null;
  providerColor: string | null;
  serviceCount: number;
};

export type PendingInviteListItem = {
  id: string;
  name: string;
  role: TenantRole;
  isProvider: boolean;
  expiresAt: string;
};

export type ResourceListItem = {
  id: string;
  name: string;
  type: 'room' | 'equipment' | 'chair' | 'other';
  location: string | null;
  isActive: boolean;
  serviceCount: number;
};

// NEX-217: uma única view combinada de profiles + service_providers (ADR-011: profiles
// já é a tabela de membros — não existe tenant_members), com a contagem de
// provider_services por prestador. Convites pendentes (tenant_invites ainda não
// aceites) são carregados à parte — não são "membros" ainda, mas a UI (filtro
// "Pendentes" implícito na lista, tal como o plano mestre pede "Todos/Prestadores/
// Gestão/Inativos") precisa de os listar como linhas informativas separadas.
export async function listTeamMembers(tenantId: string): Promise<TeamMemberListItem[]> {
  const supabase = await createClient();

  const [{ data: profileRows }, { data: providerRows }, { data: providerServiceRows }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, display_name, role, is_active')
        .eq('tenant_id', tenantId)
        .order('display_name'),
      supabase
        .from('service_providers')
        .select('id, member_user_id, status, color')
        .eq('tenant_id', tenantId),
      supabase.from('provider_services').select('provider_id').eq('tenant_id', tenantId),
    ]);

  const providerByUserId = new Map((providerRows ?? []).map((row) => [row.member_user_id, row]));
  const serviceCountByProviderId = new Map<string, number>();
  for (const row of providerServiceRows ?? []) {
    serviceCountByProviderId.set(
      row.provider_id,
      (serviceCountByProviderId.get(row.provider_id) ?? 0) + 1,
    );
  }

  return (profileRows ?? []).map((row) => {
    const provider = providerByUserId.get(row.user_id);
    return {
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role as TenantRole,
      isActive: row.is_active,
      isProvider: Boolean(provider),
      providerId: provider?.id ?? null,
      providerStatus: (provider?.status as 'active' | 'inactive' | undefined) ?? null,
      providerColor: provider?.color ?? null,
      serviceCount: provider ? (serviceCountByProviderId.get(provider.id) ?? 0) : 0,
    };
  });
}

export async function listPendingInvites(tenantId: string): Promise<PendingInviteListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_invites')
    .select('id, name, role, is_provider, expires_at')
    .eq('tenant_id', tenantId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role as TenantRole,
    isProvider: row.is_provider,
    expiresAt: row.expires_at,
  }));
}

export async function listResources(tenantId: string): Promise<ResourceListItem[]> {
  const supabase = await createClient();
  const [{ data: resourceRows }, { data: resourceServiceRows }] = await Promise.all([
    supabase
      .from('resources')
      .select('id, name, type, location, is_active')
      .eq('tenant_id', tenantId)
      .order('name'),
    supabase.from('resource_services').select('resource_id').eq('tenant_id', tenantId),
  ]);

  const serviceCountByResourceId = new Map<string, number>();
  for (const row of resourceServiceRows ?? []) {
    serviceCountByResourceId.set(
      row.resource_id,
      (serviceCountByResourceId.get(row.resource_id) ?? 0) + 1,
    );
  }

  return (resourceRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    isActive: row.is_active,
    serviceCount: serviceCountByResourceId.get(row.id) ?? 0,
  }));
}

export type ServiceOption = { id: string; name: string };

export async function listActiveServiceOptions(tenantId: string): Promise<ServiceOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('services')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');
  return data ?? [];
}

export async function listProviderServiceIds(providerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_services')
    .select('service_id')
    .eq('provider_id', providerId);
  return (data ?? []).map((row) => row.service_id);
}

export async function listResourceServiceIds(resourceId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('resource_services')
    .select('service_id')
    .eq('resource_id', resourceId);
  return (data ?? []).map((row) => row.service_id);
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { hasPermission, type TenantRole } from '@/lib/auth/permissions';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const TEAM_PAGE_PATH = '/dashboard/equipa';

async function requireTeamManager(): Promise<
  { ok: true; tenantId: string } | { ok: false; error: { code: 'FORBIDDEN'; message: string } }
> {
  const { tenantId, role } = await requireProfile();
  if (!hasPermission(role as TenantRole, 'manage_team')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem permissão para gerir a equipa.' },
    };
  }
  return { ok: true, tenantId };
}

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'manager', 'receptionist', 'provider', 'viewer']),
});

// "Owner único não pode remover-se a si próprio" também se aplica a demover-se — chama
// assert_not_last_owner (0039_tenant_members_and_providers.sql) antes de qualquer
// mudança de role de um owner, mesma garantia usada em setMemberActive.
export async function updateMemberRole(
  input: z.infer<typeof updateRoleSchema>,
): Promise<Result<null>> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { error: assertError } = await supabase.rpc('assert_not_last_owner', {
    p_tenant_id: gate.tenantId,
    p_user_id: parsed.data.userId,
  });
  if (assertError) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Não é possível remover a única dona ativa.' },
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('user_id', parsed.data.userId)
    .eq('tenant_id', gate.tenantId)
    .select('user_id');
  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pessoa não encontrada.' } };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

const setActiveSchema = z.object({ userId: z.string().uuid(), isActive: z.boolean() });

export async function setMemberActive(
  input: z.infer<typeof setActiveSchema>,
): Promise<Result<null>> {
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  if (!parsed.data.isActive) {
    const { error: assertError } = await supabase.rpc('assert_not_last_owner', {
      p_tenant_id: gate.tenantId,
      p_user_id: parsed.data.userId,
    });
    if (assertError) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Não é possível desativar a única dona ativa.',
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.isActive })
    .eq('user_id', parsed.data.userId)
    .eq('tenant_id', gate.tenantId)
    .select('user_id');
  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pessoa não encontrada.' } };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

const setProviderServicesSchema = z.object({
  providerId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).max(200),
});

// Substitui o conjunto inteiro (delete + insert) — mais simples e correto do que um
// diff campo a campo para uma lista de checkboxes, com o mesmo resultado final.
export async function setProviderServices(
  input: z.infer<typeof setProviderServicesSchema>,
): Promise<Result<null>> {
  const parsed = setProviderServicesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from('provider_services')
    .delete()
    .eq('provider_id', parsed.data.providerId)
    .eq('tenant_id', gate.tenantId);
  if (deleteError) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }

  if (parsed.data.serviceIds.length > 0) {
    const { error: insertError } = await supabase.from('provider_services').insert(
      parsed.data.serviceIds.map((serviceId) => ({
        tenant_id: gate.tenantId,
        provider_id: parsed.data.providerId,
        service_id: serviceId,
      })),
    );
    if (insertError) {
      return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
    }
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

const revokeInviteSchema = z.object({ inviteId: z.string().uuid() });

export async function revokeInvite(
  input: z.infer<typeof revokeInviteSchema>,
): Promise<Result<null>> {
  const parsed = revokeInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenant_invites')
    .delete()
    .eq('id', parsed.data.inviteId)
    .eq('tenant_id', gate.tenantId)
    .is('used_at', null)
    .select('id');
  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Convite não encontrado.' } };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

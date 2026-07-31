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

const resourceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['room', 'equipment', 'chair', 'other']),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  serviceIds: z.array(z.string().uuid()).max(200),
});

async function replaceResourceServices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  resourceId: string,
  serviceIds: readonly string[],
): Promise<{ ok: true } | { ok: false }> {
  const { error: deleteError } = await supabase
    .from('resource_services')
    .delete()
    .eq('resource_id', resourceId)
    .eq('tenant_id', tenantId);
  if (deleteError) return { ok: false };

  if (serviceIds.length > 0) {
    const { error: insertError } = await supabase.from('resource_services').insert(
      serviceIds.map((serviceId) => ({
        tenant_id: tenantId,
        resource_id: resourceId,
        service_id: serviceId,
      })),
    );
    if (insertError) return { ok: false };
  }
  return { ok: true };
}

export async function createResource(
  input: z.infer<typeof resourceInputSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = resourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resources')
    .insert({
      tenant_id: gate.tenantId,
      name: parsed.data.name,
      type: parsed.data.type,
      location: parsed.data.location || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível criar.' } };
  }

  const servicesResult = await replaceResourceServices(
    supabase,
    gate.tenantId,
    data.id,
    parsed.data.serviceIds,
  );
  if (!servicesResult.ok) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar os serviços.' },
    };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: { id: data.id } };
}

const updateResourceSchema = resourceInputSchema.extend({ id: z.string().uuid() });

export async function updateResource(
  input: z.infer<typeof updateResourceSchema>,
): Promise<Result<null>> {
  const parsed = updateResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resources')
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      location: parsed.data.location || null,
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', gate.tenantId)
    .select('id');
  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } };
  }

  const servicesResult = await replaceResourceServices(
    supabase,
    gate.tenantId,
    parsed.data.id,
    parsed.data.serviceIds,
  );
  if (!servicesResult.ok) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar os serviços.' },
    };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

const setResourceActiveSchema = z.object({ id: z.string().uuid(), isActive: z.boolean() });

export async function setResourceActive(
  input: z.infer<typeof setResourceActiveSchema>,
): Promise<Result<null>> {
  const parsed = setResourceActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const gate = await requireTeamManager();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resources')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.id)
    .eq('tenant_id', gate.tenantId)
    .select('id');
  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar.' } };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } };
  }

  revalidatePath(TEAM_PAGE_PATH);
  return { ok: true, value: null };
}

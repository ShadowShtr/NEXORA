'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { hasPermission, type TenantRole } from '@/lib/auth/permissions';
import { createInvite } from '@/lib/tenant-invite';
import { checkTeamInviteCreateRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import type { Result } from '@/lib/result';

const requestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  role: z.enum(['owner', 'manager', 'receptionist', 'provider', 'viewer']),
  isProvider: z.boolean(),
});

export type CreateTeamInviteInput = z.infer<typeof requestSchema>;

// NEX-212: "Fluxo de convite... gera link/token para partilha manual pelo owner."
// tenantId/createdBy come only from the caller's own session (requireProfile()), never
// from input — role is checked against hasPermission server-side, never trusted from
// the client either, even though the UI (NEX-217) will only ever offer roles the
// current user is allowed to grant in the first place.
export async function createTeamInvite(
  input: CreateTeamInviteInput,
): Promise<Result<{ token: string; expiresAt: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } };
  }

  const { tenantId, userId, role: callerRole } = await requireProfile();
  if (!hasPermission(callerRole as TenantRole, 'manage_team')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem permissão para gerir a equipa.' },
    };
  }

  const ip = await getRequestIp();
  const rateLimit = await checkTeamInviteCreateRateLimit(`${tenantId}:${ip}`);
  if (rateLimit.limited) {
    return {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Demasiados convites criados. Tente mais tarde.' },
    };
  }

  const supabase = await createClient();
  try {
    const { token, expiresAt } = await createInvite(supabase, {
      tenantId,
      createdBy: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      isProvider: parsed.data.isProvider,
    });
    return { ok: true, value: { token, expiresAt } };
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível criar o convite.' },
    };
  }
}

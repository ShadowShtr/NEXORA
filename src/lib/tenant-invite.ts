import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TenantRole } from '@/lib/auth/permissions';
import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
} from '@/lib/tenant-invite-token';

export { generateInviteToken, hashInviteToken, INVITE_TOKEN_PATTERN };

// NEX-212: same token shape/hash discipline as booking tokens
// (src/lib/booking-token-lookup.ts, NEX-071) — 256-bit random token, only the sha256
// hash ever touches the database, uniform "not found" for any invalid/expired/used
// token (never reveals *why*, so a guess can't learn whether an email was invited).
const DEFAULT_TTL_HOURS = 72;

export type CreateInviteInput = {
  tenantId: string;
  createdBy: string;
  name: string;
  email: string;
  role: TenantRole;
  isProvider: boolean;
  ttlHours?: number;
};

// Runs under the caller's own RLS-scoped client (not the admin client) — the caller
// already passed hasPermission(role, 'manage_team') in the Server Action boundary, and
// current_tenant_id() confirms tenantId is genuinely the caller's own tenant, same as
// every other authenticated write in this codebase.
export async function createInvite(
  supabase: SupabaseClient,
  input: CreateInviteInput,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(
    Date.now() + (input.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60_000,
  ).toISOString();

  const { error } = await supabase.from('tenant_invites').insert({
    tenant_id: input.tenantId,
    token_hash: tokenHash,
    name: input.name,
    email: input.email,
    role: input.role,
    is_provider: input.isProvider,
    created_by: input.createdBy,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return { token, expiresAt };
}

export type ResolvedInvite = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: TenantRole;
  isProvider: boolean;
};

// Public-surface lookup (no session yet) — same admin-client + timing-safe-compare
// shape as resolveBookingByToken. Never distinguishes "expired" from "used" from
// "never existed" in its return value — all three come back as null.
export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  if (!INVITE_TOKEN_PATTERN.test(token)) return null;

  const admin = createAdminClient();
  const tokenHash = hashInviteToken(token);

  const { data: invite } = await admin
    .from('tenant_invites')
    .select('id, tenant_id, name, email, role, is_provider, token_hash, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!invite) return null;

  const storedHash = Buffer.from(invite.token_hash, 'hex');
  const computedHash = Buffer.from(tokenHash, 'hex');
  if (storedHash.length !== computedHash.length || !timingSafeEqual(storedHash, computedHash)) {
    return null;
  }

  if (invite.used_at) return null;
  if (new Date(invite.expires_at).getTime() <= Date.now()) return null;

  return {
    id: invite.id,
    tenantId: invite.tenant_id,
    name: invite.name,
    email: invite.email,
    role: invite.role,
    isProvider: invite.is_provider,
  };
}

export type AcceptInviteResult =
  { ok: true } | { ok: false; reason: 'invalid_or_expired' | 'already_used' };

// Called once the caller (a Route Handler in the future NEX-217 accept-invite page)
// has already created the new auth.users row for this person — this function only
// finalizes tenant membership, atomically with marking the invite used, using the
// admin client (the new member has no profile yet, so RLS can't scope this for them).
export async function acceptInvite(token: string, newUserId: string): Promise<AcceptInviteResult> {
  const invite = await resolveInvite(token);
  if (!invite) {
    // Distinguish "used" only for the caller's own logging/UX, never leaked to the
    // token holder as a different HTTP response — resolveInvite already collapsed
    // expired/never-existed into the same null.
    const admin = createAdminClient();
    const tokenHash = hashInviteToken(token);
    const { data: usedCheck } = await admin
      .from('tenant_invites')
      .select('used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (usedCheck?.used_at) return { ok: false, reason: 'already_used' };
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const admin = createAdminClient();

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: newUserId,
    tenant_id: invite.tenantId,
    role: invite.role,
    display_name: invite.name,
  });
  if (profileError) throw profileError;

  if (invite.isProvider) {
    const { error: providerError } = await admin
      .from('service_providers')
      .insert({ tenant_id: invite.tenantId, member_user_id: newUserId });
    if (providerError) throw providerError;
  }

  const { error: markUsedError, data: updated } = await admin
    .from('tenant_invites')
    .update({ used_at: new Date().toISOString(), used_by: newUserId })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id');
  if (markUsedError) throw markUsedError;
  if (!updated || updated.length === 0) {
    // Lost a race against a second acceptance of the same token between resolveInvite
    // and this update — the profile insert above already succeeded, but the invite
    // itself must never end up usable twice. ADR-010's hasAffectedRows discipline,
    // applied here as a hard failure rather than a silent success.
    throw new Error('Invite was already used by a concurrent request.');
  }

  return { ok: true };
}

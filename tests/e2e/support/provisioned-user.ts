import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared E2E fixture: a fully provisioned owner (tenant + profile + business_settings,
// via the same provision_tenant_owner RPC scripts/provision-owner.mjs uses) so tests
// exercise the real login → authorized-route path, not a bare Auth user. Requires
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

export function canUseSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export type ProvisionedTestUser = {
  admin: SupabaseClient;
  email: string;
  password: string;
  userId: string;
  slug: string;
};

export async function createProvisionedTestUser(prefix: string): Promise<ProvisionedTestUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceRoleKey);

  const email = `${prefix}-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const slug = `${prefix}-${randomUUID().slice(0, 8)}`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw userError;

  const { error: rpcError } = await admin.rpc('provision_tenant_owner', {
    p_user_id: userData.user.id,
    p_slug: slug,
    p_business_name: 'E2E Test Salon',
    p_owner_display_name: 'Owner E2E',
  });
  if (rpcError) throw rpcError;

  return { admin, email, password, userId: userData.user.id, slug };
}

export async function cleanupProvisionedTestUser(fixture: ProvisionedTestUser) {
  // audit_logs.tenant_id is ON DELETE RESTRICT (NEX-014) — soft delete, same as product.
  await fixture.admin.from('tenants').update({ status: 'deleted' }).eq('slug', fixture.slug);
  await fixture.admin.auth.admin.deleteUser(fixture.userId);
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Shared by every layout that needs "must be a signed-in, provisioned owner" — the
// dashboard shell and the onboarding wizard both require it, so the claims + profile
// check lives here once instead of being duplicated per layout.
export async function requireProfile() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect('/login');
  }

  const userId = claimsData.claims.sub;
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  return { userId, tenantId: profile.tenant_id };
}

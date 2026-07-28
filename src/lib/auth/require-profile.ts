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
    .select('user_id, tenant_id, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  return { userId, tenantId: profile.tenant_id, displayName: profile.display_name ?? '' };
}

// NEX-142: "Pré-visualização da página pública" — /b/[slug] is the one route meant for a
// visitor with no session at all (requireProfile() would wrongly redirect them to
// /login), but it also needs to recognize the tenant's own owner when she's logged in
// and browsing her own still-unpublished page, so she can preview it before publishing.
// Returns null instead of redirecting for every "not logged in" / "no profile" case —
// safe to call from a genuinely public page.
export async function getOptionalProfile() {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return null;

  const userId = claimsData.claims.sub;
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, tenant_id, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return null;

  return { userId, tenantId: profile.tenant_id, displayName: profile.display_name ?? '' };
}

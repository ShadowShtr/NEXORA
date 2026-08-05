import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/get-auth-context';

// Shared by every layout that needs "must be a signed-in, provisioned owner" — the
// dashboard shell and the onboarding wizard both require it, so the claims + profile
// check lives here once instead of being duplicated per layout.
//
// PR3: the actual claims lookup + profile query now lives in getAuthContext(), memoized
// per request via React's cache() — calling requireProfile() from the layout and again
// from every page.tsx under it (the pre-PR3 pattern, still true for ~45 call sites)
// resolves identity/profile once per request, not once per component. This function
// keeps its exact pre-PR3 return shape ({ userId, tenantId, displayName }, now with
// tenantSlug added — additive, no existing destructure breaks) and its exact pre-PR3
// side effects (redirect, signOut before the "no profile" redirect) precisely so none
// of those 45 call sites need to change.
export async function requireProfile() {
  const context = await getAuthContext();

  if (context.status === 'unauthenticated') {
    redirect('/login');
  }

  if (context.status === 'no_profile') {
    // Not inside getAuthContext(): a memoized function must stay pure (see its own
    // comment) — signOut() is a mutation and belongs to the one call site that acts on
    // this status, not to the cached resolver every caller shares.
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  const { profile } = context;
  return {
    userId: profile.userId,
    tenantId: profile.tenantId,
    tenantSlug: profile.tenantSlug,
    displayName: profile.displayName,
  };
}

// NEX-142: "Pré-visualização da página pública" — /b/[slug] is the one route meant for a
// visitor with no session at all (requireProfile() would wrongly redirect them to
// /login), but it also needs to recognize the tenant's own owner when she's logged in
// and browsing her own still-unpublished page, so she can preview it before publishing.
// Returns null instead of redirecting for every "not logged in" / "no profile" case —
// safe to call from a genuinely public page.
//
// PR3: shares the same memoized getAuthContext() as requireProfile() — a page that
// calls both (or a page and its layout each calling one of the two) still resolves
// identity/profile only once per request.
export async function getOptionalProfile() {
  const context = await getAuthContext();

  if (context.status !== 'ok') return null;

  const { profile } = context;
  return {
    userId: profile.userId,
    tenantId: profile.tenantId,
    tenantSlug: profile.tenantSlug,
    displayName: profile.displayName,
  };
}

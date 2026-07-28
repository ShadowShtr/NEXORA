import { redirect } from 'next/navigation';
import { getOptionalProfile } from '@/lib/auth/require-profile';
import { AuthShell } from '@/features/auth/AuthShell';
import { LoginForm } from '@/features/auth/LoginForm';

// A signed-in visitor landing on /login (an old bookmark, browser back button) used
// to just see the form again — harmless, but not what a "porta de entrada" should
// do. Checked server-side, before anything renders, so there's no flash of the form
// first.
//
// Deliberately reuses getOptionalProfile() (claims *and* a profile row) rather than a
// bare supabase.auth.getClaims() check — confirmed live that the bare-claims version
// deadlocks into a redirect loop for the "authenticated, no profile" case
// (protected-routes.spec.ts): requireProfile() signs the session out before bouncing
// here with ?error=no_profile, but that sign-out happens mid-render in a plain Server
// Component, and the still-valid JWT can outlive it long enough for a bare claims
// check to see a "logged in" session and bounce straight back to /dashboard, which
// signs out and bounces here again, forever. Gating on profile existence instead
// breaks the cycle regardless of that timing: a profile-less session is never one
// this page should redirect away on, since /dashboard would just reject it again.
export default async function LoginPage() {
  const profile = await getOptionalProfile();
  if (profile) redirect('/dashboard');

  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}

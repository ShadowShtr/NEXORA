import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // Re-validated here even though the proxy already checked: claims must be verified
  // on the server at the point of use, not assumed from an earlier hop (CLAUDE.md).
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect('/login');
  }

  const userId = claimsData.claims.sub;
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    // A valid session without a profile means the account was never provisioned
    // (CLAUDE.md: no public sign-up) — never leave it signed in on a route it
    // shouldn't reach.
    await supabase.auth.signOut();
    redirect('/login?error=no_profile');
  }

  return <>{children}</>;
}

import { redirect } from 'next/navigation';

// The public marketing landing (hero, "Entrar na área da profissional") is being
// dropped as the entry point per explicit product decision: the dona's own workflow
// only ever lands here to get to her account, so the marketing copy was pure friction.
// Delegating straight to /login rather than duplicating its logic here: LoginPage
// already checks getOptionalProfile() and bounces an already-signed-in visitor
// through to /dashboard, so a returning, still-logged-in dona also skips the form.
// The dedicated public landing (nnexora.pt marketing site) is EPIC-32/NEX-341,
// tracked separately — this route currently has no other consumer to preserve.
export default function HomePage() {
  redirect('/login');
}

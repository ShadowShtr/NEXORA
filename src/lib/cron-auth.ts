// NEX-161: shared check for Vercel Cron-only routes. Pure so it can be unit-tested
// without spinning up a request — see tests/unit/cron-auth.test.ts.
export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret) return true;
  return authorizationHeader === `Bearer ${cronSecret}`;
}

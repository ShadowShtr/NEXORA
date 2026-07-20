const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// NEX-066 bot protection for the public booking form. TURNSTILE_SECRET_KEY is optional
// (docs/ENVIRONMENTS_AND_SECRETS.md: "Planeado — introduzido em NEX-066") — when unset,
// verification is skipped entirely rather than blocking every visitor, same posture as
// rate-limit.ts when Upstash isn't configured. Reads process.env directly rather than
// through src/lib/env.ts's serverEnv() for the same reason as rate-limit.ts: that
// module's eager parse of the full app schema would make this file depend on unrelated
// required Supabase env vars.
export async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
  const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: remoteIp,
  });

  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;
    const data = (await response.json()) as { success: boolean };
    return data.success === true;
  } catch {
    // Network failure talking to Cloudflare must not be indistinguishable from "user is
    // a bot" — fail open on transport errors, same as every other best-effort external
    // check in this codebase (rate limiting itself fails open when unconfigured).
    return true;
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

// NEX-164 correction to NEX-153: this file is deliberately named `middleware.ts`
// again, not `proxy.ts` — Next.js 16.2.10's Turbopack *production* build silently
// fails to detect a `src/proxy.ts` entry point at all (`.next/server/middleware-
// manifest.json` comes out completely empty — `"middleware": {}` — from a clean
// `next build`, confirmed by direct A/B rebuild: renaming this exact file back to
// `middleware.ts`/`export function middleware` is what makes Turbopack populate the
// manifest and actually compile a matcher). The framework's own deprecation warning
// recommends `proxy.ts`, but following it here silently disabled every header this
// file sets (no-store on auth/booking routes, and now CSP) in any real `next build` —
// dev mode and the warning message don't reveal this gap. Do not rename this file
// back to `proxy.ts` without re-verifying `.next/server/middleware-manifest.json` is
// non-empty after a clean `next build`.
//
// NEX-164: "Headers/CSP completos — nonce CSP e políticas verificadas sem quebrar
// app." A per-request nonce can only be generated here (proxy/middleware runs before
// every request) and threaded through `x-nonce` so app/layout.tsx can read it via
// next/headers and Next.js can apply it to its own inlined scripts — a static CSP in
// next.config.ts's headers() has no way to vary per request. `'strict-dynamic'`
// covers Next's own runtime/hydration scripts; the explicit host allowlists are the
// CSP3-documented fallback for browsers that don't support strict-dynamic (they still
// need the nonce, but ignore the propagation strict-dynamic gives on top of it).
// Sources needed, confirmed by reading the actual app code, not assumed: Turnstile
// (src/app/b/[slug]/TurnstileWidget.tsx) loads a script from and renders an iframe on
// challenges.cloudflare.com; Supabase (client-side auth/data calls, Storage-hosted
// photos) always lives under *.supabase.co. Nothing else in this app loads a
// browser-side external script, iframe, or fetch target (verified: WhatsApp/Instagram/
// Google Maps links are plain outbound <a href> navigation, not CSP-governed
// resource loads; Resend/Turnstile-verify calls are server-side fetches, which CSP
// — a browser-only mechanism — never applies to).
const NO_STORE_PATHS = [
  '/login',
  '/definir-password',
  '/recuperar-password',
  '/onboarding',
  '/dashboard',
  '/marcacao',
  '/api/bookings',
];

function isNoStorePath(pathname: string): boolean {
  return NO_STORE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const directives = [
    `default-src 'self'`,
    // 'unsafe-eval' is required only for Next.js dev-mode's own Fast Refresh runtime —
    // never present in a production build.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ''}`,
    // No nonce here deliberately: pairing a nonce with 'unsafe-inline' in the *same*
    // directive makes nonce-aware browsers ignore 'unsafe-inline' entirely (CSP2 rule),
    // which would break this app's style={{...}} attributes (used in 5 files for
    // dynamic bar widths/skeletons, confirmed by reading the code) — there is no nonce
    // mechanism for inline style *attributes* at all, only for <style> elements. The
    // real XSS-relevant boundary is script-src, kept strict above; a plain, unnonced
    // 'unsafe-inline' here is a common, deliberate trade-off, not an oversight.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `font-src 'self'`,
    `connect-src 'self' https://*.supabase.co${isDev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    `frame-src https://challenges.cloudflare.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  // NEX-170: "Logs estruturados e redaction — Correlation ID." Generated once per
  // request, here, same reasoning as the nonce above — this is the one place that
  // sees every request before anything else runs. Threaded through as a request
  // header so Server Components/Actions can read it via next/headers
  // (src/lib/request-id.ts) and stamp every log line from this request with the same
  // id, and echoed back as a response header so it can be surfaced to a visitor
  // reporting an issue ("what's the id at the top of your network tab?").
  const requestId = crypto.randomUUID();

  // Re-read from `request.headers` (rather than cloning it once, up front) every time
  // a response is built: `supabase.auth.getUser()` below can rewrite `request`'s
  // cookies via `setAll` before a refreshed-session response is built, and only a
  // fresh read picks up that rewrite. A one-time clone taken before the Supabase call
  // would carry the pre-refresh cookies forward instead.
  function requestHeadersWithNonce() {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('x-request-id', requestId);
    return headers;
  }

  // PR3 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR3 update): this used to be the
  // "root proxy" the comment in src/lib/supabase/server.ts wrongly claimed already
  // refreshed sessions (PR1 finding, corrected as a comment-only fix in PR2). It
  // actually does now. `response` is `let`, not `const`, because @supabase/ssr's
  // `setAll` below — invoked only when `getUser()` finds an expired access token and
  // successfully refreshes it — needs to attach the new session cookies to a response
  // built from the *post-mutation* request, not the one built here before any cookie
  // exists to attach. This is the official @supabase/ssr pattern for Next.js
  // middleware: never discard/replace this response after `setAll` has written to it,
  // and always return the exact same object your custom headers below get applied to.
  let response = NextResponse.next({ request: { headers: requestHeadersWithNonce() } });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          // Mutate the *request*'s cookies first so Server Components rendered later
          // in this same request see the refreshed session immediately (not one
          // request behind) — `requestHeadersWithNonce()` below reads `request.headers`
          // fresh, which reflects this mutation.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeadersWithNonce() } });
          // Then mirror the same cookies onto the *response* so the browser actually
          // receives the refreshed session — mutating `request.cookies` alone never
          // reaches the client.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getClaims()) deliberately: this is the one call that can round-trip
  // to the Auth server and actually use the refresh token to mint a new access token
  // when the current one has expired — getClaims() only decodes whatever JWT is
  // already sitting in the cookie, it can never refresh anything on its own. The
  // returned user is intentionally unused here: this middleware's job is only to keep
  // the session cookie fresh, not to gate routes — authorization stays exactly where
  // it already was, in requireProfile()/getOptionalProfile() (now backed by
  // src/lib/auth/get-auth-context.ts), so this PR doesn't duplicate authorization logic
  // into a second place. An expired-and-unrefreshable (or altogether absent) session
  // simply means `getUser()` resolves with no user and no cookies are rewritten —
  // requireProfile() then sees no valid claims on its own next call and redirects,
  // same as before this PR.
  await supabase.auth.getUser();

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-request-id', requestId);

  if (isNoStorePath(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)'],
};

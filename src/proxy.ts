import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// NEX-153: "Estratégia de cache segura — no-store para auth/booking token." Next.js's
// own default `Cache-Control` for these dynamic routes (`no-cache, must-revalidate`,
// set internally while rendering) overrides a plain `headers()` rule in
// next.config.ts — verified empirically via `next start` + curl, a plain config-level
// header rule never showed up on the actual response. Proxy (formerly "middleware")
// runs last in the response pipeline, so setting it here is what actually reaches the
// client. Pure path-matching only — no I/O, no auth logic — so this can't itself
// become a reason login breaks.
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/login',
    '/definir-password',
    '/recuperar-password',
    '/onboarding',
    '/dashboard/:path*',
    '/marcacao/:path*',
    '/api/bookings/:path*',
  ],
};

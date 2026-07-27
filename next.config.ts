import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // NEX-164: docs/05_SECURITY_PRIVACY.md "HSTS em produção". Safe to send unconditionally
  // — browsers only act on it over an actual HTTPS response (harmless over local plain
  // HTTP). Deliberately omits the `preload` directive: submitting to the browser HSTS
  // preload list is a hard-to-reverse decision (removal can take months to propagate)
  // that the dona should make consciously later, not something to opt her into here.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  // Playwright's webServer drives the dev server from 127.0.0.1; without this, Next.js
  // blocks the HMR cross-origin request as a dev-only safety default (not a security
  // control affected by this — production builds don't run the dev HMR endpoint).
  allowedDevOrigins: ['127.0.0.1'],
  // NEX-153/164: `Cache-Control: no-store` (auth/booking-token routes) and the CSP
  // (with its per-request nonce, NEX-164) are both enforced in src/middleware.ts, not
  // here — a plain `headers()` rule on those paths gets overridden by Next.js's own
  // internally-set Cache-Control for dynamically-rendered routes (verified via
  // `next start` + curl), and a static CSP here has no way to carry a per-request
  // nonce at all. Middleware runs last in the response pipeline, so it's what actually
  // reaches the client.
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;

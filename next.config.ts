import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  // Playwright's webServer drives the dev server from 127.0.0.1; without this, Next.js
  // blocks the HMR cross-origin request as a dev-only safety default (not a security
  // control affected by this — production builds don't run the dev HMR endpoint).
  allowedDevOrigins: ['127.0.0.1'],
  // NEX-153: the `Cache-Control: no-store` requirement for auth/booking-token routes
  // is enforced in src/middleware.ts, not here — a plain `headers()` rule on those
  // paths gets overridden by Next.js's own internally-set Cache-Control for
  // dynamically-rendered routes (verified via `next start` + curl); middleware runs
  // last in the response pipeline, so it's what actually reaches the client.
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;

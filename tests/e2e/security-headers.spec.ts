import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-164: "Headers/CSP completos — nonce CSP e políticas verificadas sem quebrar
// app", required test category "Header tests". Confirms both halves of the
// acceptance criterion directly: the headers are actually present with the expected
// shape, and — the part that matters most — no real page load ever trips a CSP
// violation (a wrong directive fails silently in curl/manual header inspection, only
// a real browser enforcing the policy would reveal it). This is also the regression
// guard for the NEX-153 finding this task corrected: Next.js 16.2.10's Turbopack
// production build never detects a `src/proxy.ts` entry point at all (confirmed by
// direct A/B rebuild — `middleware-manifest.json` comes out empty), so these headers
// silently stop being sent if this file is ever renamed back to `proxy.ts` without
// re-verifying the manifest.
test.describe('security headers e CSP (NEX-164)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex164');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('login page is served with a nonce-based CSP and HSTS', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response!.headers();

    expect(headers['strict-transport-security']).toContain('max-age=63072000');

    const csp = headers['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src 'self' 'nonce-[a-f0-9]+' 'strict-dynamic'/);
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  test('the same request never gets two different nonces', async ({ page }) => {
    const response = await page.goto('/login');
    const csp = response!.headers()['content-security-policy']!;
    const nonceMatches = [...csp.matchAll(/'nonce-([a-f0-9]+)'/g)].map((m) => m[1]);
    expect(new Set(nonceMatches).size).toBe(1);
  });

  // NEX-170: "Logs estruturados e redaction — Correlation ID." src/middleware.ts sets
  // x-request-id on every request; this confirms it actually reaches the client (so a
  // visitor reporting an issue could quote it) and is genuinely per-request, not a
  // build-time constant that would make log correlation meaningless.
  test('every response carries a unique x-request-id', async ({ page }) => {
    const first = await page.goto('/login');
    const second = await page.goto('/login');

    const firstId = first!.headers()['x-request-id'];
    const secondId = second!.headers()['x-request-id'];

    expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondId).toMatch(/^[0-9a-f-]{36}$/);
    expect(firstId).not.toBe(secondId);
  });

  test('a real page load never trips a CSP violation, and the app stays interactive', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy|refused to/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    // Proves hydration actually completed (not just that the HTML rendered) — a
    // React-uncontrolled page would leave this empty.
    await page.getByLabel('E-mail').fill(user.email);
    await expect(page.getByLabel('E-mail')).toHaveValue(user.email);

    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    expect(violations).toEqual([]);
  });

  test('the public booking lookup page loads without a CSP violation', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy|refused to/i.test(msg.text())) {
        violations.push(msg.text());
      }
    });

    await page.goto('/marcacao');
    await expect(page.getByRole('heading')).toBeVisible();
    expect(violations).toEqual([]);
  });
});

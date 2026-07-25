import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-153: "Estratégia de cache segura — assets somente; no-store para auth/booking
// token", required test category "Inspeção service worker". Verifies both halves of
// the strategy directly: the Cache Storage API contents the service worker actually
// wrote (never anything outside /_next/static or /icons), and the HTTP response
// headers on the auth/booking-token routes (next.config.ts).
test.describe('cache segura (NEX-153)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex153');
  });

  test.afterAll(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('service worker registers and only caches static assets, never auth or app pages', async ({
    page,
  }) => {
    await page.goto('/dashboard/agenda');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    // A second navigation after the service worker is active/controlling, so it has a
    // chance to intercept and cache this page's asset requests.
    await page.goto('/dashboard/mais');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const cachedPaths = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const paths: string[] = [];
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const request of requests) paths.push(new URL(request.url).pathname);
      }
      return paths;
    });

    for (const pathname of cachedPaths) {
      expect(pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/')).toBe(true);
    }
    expect(cachedPaths.some((p) => p.startsWith('/dashboard'))).toBe(false);
    expect(cachedPaths.some((p) => p.startsWith('/api/'))).toBe(false);
    expect(cachedPaths.some((p) => p.startsWith('/login'))).toBe(false);
  });

  test('dashboard (auth-bound) is served with Cache-Control: no-store', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.headers()['cache-control']).toBe('no-store');
  });

  test('booking-token API route is served with Cache-Control: no-store', async ({ page }) => {
    const response = await page.request.get('/api/bookings/nonexistent-token');
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});

import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// PR2 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md secção 3.4): the day/week/list tabs and
// the previous/today/next date controls used to be plain `<a href={string}>` — every
// click was a full document navigation. Now `next/link`. This test pins the regression:
// none of those controls may ever cause a document-type network request again, the
// layout (and therefore its client-side state) must stay mounted across the clicks, and
// back/forward must still land on the right URL.
test.describe('agenda internal navigation stays client-side (PR2)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    if (user) await cleanupProvisionedTestUser(user);
  });

  test('day/week/list tabs and date prev/next/today do not trigger a document request, keep the layout mounted, and back/forward stay correct', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex-pr2-agenda-nav');

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Palavra-passe').fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/agenda');
    await expect(page).toHaveURL(/view=day/);

    // A full document navigation tears down and rebuilds `window` — a client-side
    // (SPA) transition does not. Planting a marker before the clicks and checking it
    // survives is a direct, well-understood proxy for "the layout stayed mounted",
    // independent of and in addition to the document-request count below.
    await page.evaluate(() => {
      (window as unknown as { __nxTestMarker?: boolean }).__nxTestMarker = true;
    });

    const documentRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests.push(request.url());
    });

    await page.getByRole('tab', { name: 'Semana' }).click();
    await expect(page).toHaveURL(/view=week/);

    await page.getByRole('tab', { name: 'Lista' }).click();
    await expect(page).toHaveURL(/view=month/);

    await page.getByRole('link', { name: 'Data anterior' }).click();
    await page.getByRole('link', { name: 'Data seguinte' }).click();
    await page.getByRole('link', { name: 'Data seguinte' }).click();
    await page.getByRole('link', { name: 'Hoje' }).click();
    await expect(page).toHaveURL(/view=month/);

    await page.getByRole('tab', { name: 'Dia' }).click();
    await expect(page).toHaveURL(/view=day/);

    expect(
      documentRequests,
      `expected zero document-type requests during client-side agenda navigation, got: ${documentRequests.join(', ')}`,
    ).toHaveLength(0);

    expect(
      await page.evaluate(() => (window as unknown as { __nxTestMarker?: boolean }).__nxTestMarker),
    ).toBe(true);

    // back/forward: history entries were pushed by next/link's client router, not by
    // full page loads, and must still resolve to the right view.
    await page.goBack();
    await expect(page).toHaveURL(/view=month/);
    await page.goForward();
    await expect(page).toHaveURL(/view=day/);
  });
});

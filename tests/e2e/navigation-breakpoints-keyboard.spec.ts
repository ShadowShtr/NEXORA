import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

// NEX-151: "Navegação mobile e desktop — bottom nav e sidebar coerentes", required test
// categories "Breakpoints e teclado". dashboard-shell.spec.ts (NEX-023) already checks
// that the nav appropriate for the *project's own* viewport is shown; this file adds
// the two things that were still missing: an explicit check of the exact CSS breakpoint
// (globals.css: `@media (min-width: 761px)`) regardless of which project runs it, and
// keyboard operability of both layouts (focus + Enter activates navigation).
test.describe('navegação — breakpoints e teclado (NEX-151)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex151');
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

  test('switches layout exactly at the 761px breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 800 });
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.desktop-nav')).toBeHidden();

    await page.setViewportSize({ width: 761, height: 800 });
    await expect(page.locator('.desktop-nav')).toBeVisible();
    await expect(page.locator('.mobile-nav')).toBeHidden();
  });

  test('primary navigation is keyboard-operable', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1280) < 761;
    const nav = isMobile ? page.locator('.mobile-nav') : page.locator('.desktop-nav');
    const agendaLink = nav.getByRole('link', { name: 'Agenda' });

    await agendaLink.focus();
    await expect(agendaLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard\/agenda/);
  });

  test('desktop sidebar "Gestão" links are keyboard-operable', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) < 761, 'desktop-only');

    const financeLink = page.locator('.desktop-nav').getByRole('link', { name: 'Financeiro' });
    await financeLink.focus();
    await expect(financeLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard\/financeiro/);
  });
});

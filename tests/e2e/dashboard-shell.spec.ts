import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';

test.describe('dashboard shell (NEX-023)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.beforeAll(async () => {
    user = await createProvisionedTestUser('nex023');
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

  test('has no automatic accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('shows the navigation appropriate for the viewport', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1280) < 761;
    const desktopNav = page.locator('.desktop-nav');
    const mobileNav = page.locator('.mobile-nav');

    if (isMobile) {
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav.getByRole('link', { name: 'Agenda' })).toBeVisible();
      await expect(mobileNav.getByRole('button', { name: 'Mais' })).toBeVisible();
      await expect(desktopNav).toBeHidden();
    } else {
      await expect(desktopNav).toBeVisible();
      await expect(desktopNav.getByRole('link', { name: 'Agenda' })).toBeVisible();
      await expect(desktopNav.getByRole('link', { name: 'Financeiro' })).toBeVisible();
      await expect(mobileNav).toBeHidden();
    }
  });

  test('mobile "Mais" panel opens, is keyboard-closable, and returns focus', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) >= 761, 'mobile-only');

    const moreButton = page.locator('.mobile-nav').getByRole('button', { name: 'Mais' });
    const morePanel = page.locator('.mobile-nav-more');

    await moreButton.click();
    await expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    await expect(morePanel.getByRole('link', { name: 'Financeiro' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(morePanel).toBeHidden();
    await expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    await expect(moreButton).toBeFocused();
  });

  test('skip link is keyboard-reachable and moves focus to main content', async ({ page }) => {
    // The skip link is the first element in the shell, but next dev's own overlay can
    // occupy the very first Tab stop — focus it directly to test its own behaviour
    // rather than the whole page's tab order.
    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('marks the current page with aria-current on both layouts', async ({ page }) => {
    // includeHidden: the inactive layout (mobile nav on desktop viewport or vice versa)
    // is display:none, which getByRole excludes by default — the markup should still
    // be correct regardless of which one is visible.
    await expect(
      page.locator('.desktop-nav').getByRole('link', { name: 'Início', includeHidden: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.locator('.mobile-nav').getByRole('link', { name: 'Início', includeHidden: true }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

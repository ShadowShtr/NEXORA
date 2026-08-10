import { expect, test } from '@playwright/test';

test('home page redirects straight to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bem-vinda de volta' })).toBeVisible();
});

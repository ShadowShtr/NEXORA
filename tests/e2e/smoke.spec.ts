import { expect, test } from '@playwright/test';

test('home page presents NEXORA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'NEXORA' })).toBeVisible();
});

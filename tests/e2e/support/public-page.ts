import type { Page } from '@playwright/test';

// Passo 1 of /b/{slug} (NEX-051) — completing it is the gate every other assertion
// about the catalog/cart needs to get past first.
export async function completeRegistration(page: Page, name: string, phone: string) {
  await page.getByLabel('O seu nome').fill(name);
  await page.getByLabel('Telemóvel').fill(phone);
  await page.getByRole('button', { name: 'Continuar' }).click();
}

import type { Page } from '@playwright/test';

type BusinessStepOverrides = Partial<{
  phone: string;
  addressLine: string;
  postalCode: string;
  locality: string;
  mapsUrl: string;
}>;

export async function fillBusinessStep(page: Page, overrides: BusinessStepOverrides = {}) {
  // exact: true — several field labels are substrings of the form's own aria-label
  // ("Negócio e morada"), which getByLabel matches by default (case-insensitive
  // substring), making an unscoped query ambiguous.
  await page.getByLabel('Telemóvel', { exact: true }).fill(overrides.phone ?? '910000000');
  await page
    .getByLabel('Morada', { exact: true })
    .fill(overrides.addressLine ?? 'Rua Exemplo, 123');
  await page.getByLabel('Código postal', { exact: true }).fill(overrides.postalCode ?? '1000-001');
  await page.getByLabel('Localidade', { exact: true }).fill(overrides.locality ?? 'Lisboa');
  if (overrides.mapsUrl !== undefined) {
    await page
      .getByLabel('Link do Google Maps (opcional)', { exact: true })
      .fill(overrides.mapsUrl);
  }
}

export async function completeBusinessStep(page: Page, overrides: BusinessStepOverrides = {}) {
  await fillBusinessStep(page, overrides);
  await page.getByRole('button', { name: 'Seguinte' }).click();
}

// Step 2 loads pre-filled with valid recommended defaults (NEX-032) — submitting as-is
// is enough to advance for tests that just need to get past this step.
export async function completeHoursStep(page: Page) {
  await page.getByRole('button', { name: 'Seguinte' }).click();
}

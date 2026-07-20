import type { Page } from '@playwright/test';

// Passo 1 of /b/{slug}: pick at least one service, so the cart is non-empty and the
// rest of the flow (slot picker, registration, confirm) renders. Callers that need a
// specific service name should select it themselves; this picks whichever is first.
export async function selectFirstService(page: Page) {
  await page.locator('.public-service-choice input[type="checkbox"]').first().check();
}

// Passo 2: the calendar auto-selects the first day with availability and shows its
// time slots — this just picks the first slot button offered.
export async function selectFirstSlot(page: Page) {
  await page
    .locator('.public-slot-picker .public-slot-button')
    .first()
    .waitFor({ state: 'visible' });
  await page.locator('.public-slot-picker .public-slot-button').first().click();
}

// Passo 3 — completing it is the gate the confirm step needs. Requires a service and a
// slot to already be selected (the registration card only renders once both are set).
export async function completeRegistration(page: Page, name: string, phone: string) {
  await page.getByLabel('O seu nome').fill(name);
  await page.getByLabel('Telemóvel').fill(phone);
  await page.getByRole('button', { name: 'Continuar' }).click();
}

// Convenience for tests that only care about reaching "Passo 4 · Confirmar" and don't
// exercise service/slot selection themselves.
export async function completeBookingUpToConfirm(page: Page, name: string, phone: string) {
  await selectFirstService(page);
  await selectFirstSlot(page);
  await completeRegistration(page, name, phone);
}

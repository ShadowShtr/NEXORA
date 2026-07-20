import { expect, type Page } from '@playwright/test';

// Visual refinement mid-2026: /b/{slug} moved from one scrolling page with progressive
// disclosure to a real page per step (/servicos → /horario → /dados → /resumo), each a
// fresh navigation carrying state via the same-device draft (NEX-052) rather than React
// state. These helpers advance one real page at a time instead of revealing the next
// card in place.

// /servicos: pick at least one service, then "Continuar" navigates to /horario. Callers
// that need a specific service name should select it themselves; this picks whichever
// is first.
export async function selectFirstService(page: Page) {
  await page.locator('.public-service-choice input[type="checkbox"]').first().check();
  await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/horario$/);
}

// /horario: the calendar auto-selects the first day with availability and shows its
// time slots — picks the first slot offered, then "Continuar" navigates to /dados.
export async function selectFirstSlot(page: Page) {
  await page
    .locator('.public-slot-picker .public-slot-button')
    .first()
    .waitFor({ state: 'visible' });
  await page.locator('.public-slot-picker .public-slot-button').first().click();
  await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/dados$/);
}

// /dados: submitting navigates to /resumo. Requires a service and a slot to already be
// selected (this page itself redirects back to /horario otherwise).
export async function completeRegistration(page: Page, name: string, phone: string) {
  await page.getByLabel('O seu nome').fill(name);
  await page.getByLabel('Telemóvel').fill(phone);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/resumo$/);
}

// Convenience for tests that only care about reaching /resumo and don't exercise
// service/slot selection themselves. Does not click "Confirmar marcação" — callers that
// need an actual booking created do that themselves.
export async function completeBookingUpToConfirm(page: Page, name: string, phone: string) {
  await selectFirstService(page);
  await selectFirstSlot(page);
  await completeRegistration(page, name, phone);
}

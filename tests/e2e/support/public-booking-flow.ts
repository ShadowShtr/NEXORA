import { expect, type Page } from '@playwright/test';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Single point of contact between e2e specs and the real public booking route tree:
//
//   /b/{slug} -> /b/{slug}/servicos -> /b/{slug}/horario -> /b/{slug}/dados
//   -> /b/{slug}/resumo -> (confirmation, rendered in place by ResumoClient)
//
// Visual refinement mid-2026 moved the flow from one scrolling page with progressive
// disclosure to a real page per step (src/app/b/[slug]/useBookingSession.ts's own
// comment explains why: each step is a fresh navigation, so React state can't carry
// the selection between them on its own). Specs that poked at page.getByRole/locator
// directly for each step had to be rewritten by hand, one by one, when that migration
// landed — this class exists so the next redesign only needs updating in one place.
export class PublicBookingFlow {
  constructor(private readonly page: Page) {}

  async openProfile(slug: string) {
    return this.page.goto(`/b/${slug}`);
  }

  async startBooking(slug: string) {
    return this.page.goto(`/b/${slug}/servicos`);
  }

  get cartBar() {
    return this.page.locator('.public-cart-bar');
  }

  async selectService(name: string) {
    await this.page.getByRole('checkbox', { name: new RegExp(escapeRegExp(name)) }).check();
  }

  async deselectService(name: string) {
    await this.page.getByRole('checkbox', { name: new RegExp(escapeRegExp(name)) }).uncheck();
  }

  async selectPackage(name: string) {
    await this.page.getByRole('tab', { name: 'Pacotes' }).click();
    await this.page.getByRole('radio', { name: new RegExp(escapeRegExp(name)) }).check();
  }

  async clearPackage() {
    await this.page.getByRole('tab', { name: 'Pacotes' }).click();
    await this.page.getByRole('radio', { name: 'Nenhum pacote' }).check();
  }

  async goToServicesTab() {
    await this.page.getByRole('tab', { name: 'Serviços' }).click();
  }

  async continueFromServices() {
    await this.cartBar.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page).toHaveURL(/\/horario$/);
  }

  // dateKey is "yyyy-MM-dd" (SlotPicker's own calendar-day aria-label — see
  // src/app/b/[slug]/SlotPicker.tsx).
  async selectDate(dateKey: string) {
    await this.page.getByRole('gridcell', { name: dateKey }).click();
  }

  async selectFirstAvailableTime() {
    const firstSlot = this.page.locator('.public-slot-picker .public-slot-button').first();
    await firstSlot.waitFor({ state: 'visible' });
    await firstSlot.click();
  }

  async continueFromHorario() {
    await this.cartBar.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page).toHaveURL(/\/dados$/);
  }

  // Submits "Os seus dados" and waits for the real navigation to /resumo — there is no
  // in-place "Passo 4" reveal anymore (that was the pre-migration single-page flow).
  async fillClientData(data: { name: string; phone: string; email?: string }) {
    await this.page.getByLabel('O seu nome').fill(data.name);
    await this.page.getByLabel('Telemóvel').fill(data.phone);
    if (data.email) await this.page.getByLabel('E-mail (opcional)').fill(data.email);
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page).toHaveURL(/\/resumo$/);
  }

  async reviewBooking() {
    await expect(this.page.getByRole('heading', { name: 'Resumo da marcação' })).toBeVisible();
  }

  async confirmBooking() {
    await this.page.locator('.public-resumo-confirm').click();
  }

  // BookingConfirmation renders in place of ResumoClient's form once createPublicBooking
  // succeeds — no navigation, so this only waits for the new heading, not a URL change.
  async expectConfirmation() {
    await expect(
      this.page.getByRole('heading', { name: 'Marcação confirmada com sucesso!' }),
    ).toBeVisible({ timeout: 15_000 });
  }

  // Convenience for specs that only care about *reaching* a state (e.g. testing
  // confirmation-screen links, or a race between two browser contexts) rather than
  // asserting on each intermediate step.
  async bookFirstAvailable(data: { name: string; phone: string; email?: string }) {
    const firstCheckbox = this.page
      .locator('.public-service-choice input[type="checkbox"]')
      .first();
    await firstCheckbox.check();
    await this.continueFromServices();
    await this.selectFirstAvailableTime();
    await this.continueFromHorario();
    await this.fillClientData(data);
  }
}

import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration, selectFirstService, selectFirstSlot } from './support/public-page';

// Mirrors src/lib/booking-draft-crypto.ts#hashResumeToken exactly (SHA-256 hex) — kept
// local instead of importing the `@/lib` alias, matching the other e2e specs, which
// never import app internals directly.
function hashResumeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function draftStorageKey(slug: string) {
  return `nexora-draft-${slug}`;
}

// useBookingSession's same-tab sessionStorage cache (src/app/b/[slug]/useBookingSession.ts)
// is checked *before* the DB-backed resume token, and short-circuits it entirely when
// present — so a plain page.reload() in the same tab never exercises the DB draft path
// at all. Clearing this key is how a test forces a real trip through resumeBookingDraft,
// simulating what a new tab/session (empty sessionStorage, token still in localStorage)
// would do.
function sessionStateKey(slug: string) {
  return `nexora-draft-state-${slug}`;
}

// PublicBookingCart debounces autosave by 600ms after the last change (registration or
// selection). The *first* save of a test run can additionally be slowed down by
// Next.js dev-mode's on-demand compilation of the route/action on first hit, so it's
// polled for with no fixed budget instead of a flat sleep.
async function waitForDraftToken(page: Page, key: string) {
  await page.waitForFunction((k) => window.localStorage.getItem(k) !== null, key);
}

// Once the server has handled one request it's warm, so a fixed margin past the 600ms
// debounce reliably covers a *subsequent* save (e.g. a checkbox toggle after the
// registration save already landed) without racing ahead of it.
async function settleDraftSave(page: Page) {
  await page.waitForTimeout(700);
}

async function publishTenantWithOneService(user: ProvisionedTestUser) {
  const { data: tenant } = await user.admin
    .from('tenants')
    .select('id')
    .eq('slug', user.slug)
    .single();
  await user.admin
    .from('business_settings')
    .update({
      phone_e164: '+351912345678',
      published_at: new Date().toISOString(),
      min_notice_hours: 1,
    })
    .eq('tenant_id', tenant!.id);
  await user.admin.from('tenants').update({ status: 'active' }).eq('id', tenant!.id);
  await user.admin.from('business_hours').insert(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenant!.id,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '00:00',
      closes_at: '23:30',
    })),
  );
  const { data: category } = await user.admin
    .from('service_categories')
    .insert({ tenant_id: tenant!.id, name: 'Manicure' })
    .select('id')
    .single();
  await user.admin.from('services').insert({
    tenant_id: tenant!.id,
    category_id: category!.id,
    name: 'Verniz gel',
    price_cents: 2500,
    duration_minutes: 60,
  });
  return tenant!.id as string;
}

// NEX-052: same-device draft recovery via a resume token kept only in this browser's
// localStorage — no e-mail step, no session. Covers the task's required criteria:
// resume restores state, an unrecognized token is ignored without crashing, and an
// expired draft is both rejected and deleted from booking_drafts ("limpeza"). Visual
// refinement mid-2026 spread the flow across /servicos -> /horario -> /dados -> /resumo
// (docs/UI_SCREEN_SPECIFICATIONS.md), so "resume" is now exercised at whichever page a
// visitor lands back on, not by reloading a single scrolling page.
test.describe('public booking draft recovery (NEX-052)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('resumes selection and registration on reload, on the same device, with no e-mail step', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex052');
    await publishTenantWithOneService(user);

    const key = draftStorageKey(user.slug);
    await page.goto(`/b/${user.slug}/servicos`);
    await selectFirstService(page);
    await selectFirstSlot(page);
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await waitForDraftToken(page, key);

    const tokenBeforeReload = await page.evaluate((k) => window.localStorage.getItem(k), key);
    expect(tokenBeforeReload).not.toBeNull();

    await page.reload();

    // Still on /resumo after reload — the draft carried selection, slot and
    // registration through, so the summary renders straight away instead of bouncing
    // back through /servicos -> /horario -> /dados again.
    await expect(page.getByRole('heading', { name: 'Resumo da marcação' })).toBeVisible();
    await expect(page.getByText('Verniz gel')).toBeVisible();
    await expect(page.locator('.public-resumo-total-value')).toHaveText('25,00 €');

    // A fresh visit back to /servicos also resumes the same selection.
    await page.goto(`/b/${user.slug}/servicos`);
    await expect(page.getByRole('checkbox', { name: 'Verniz gel' })).toBeChecked();

    // Continuing again reuses the same draft row/token instead of creating a new one
    // (saveBookingDraft's existingToken parameter) — no orphaned rows left behind.
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await settleDraftSave(page);
    expect(await page.evaluate((k) => window.localStorage.getItem(k), key)).toBe(tokenBeforeReload);
  });

  test('ignores an unrecognized resume token without crashing and shows the catalog fresh', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex052');
    await publishTenantWithOneService(user);
    const key = draftStorageKey(user.slug);

    await page.addInitScript(({ k, bogus }) => window.localStorage.setItem(k, bogus), {
      k: key,
      bogus: 'a'.repeat(64),
    });

    const response = await page.goto(`/b/${user.slug}/servicos`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('checkbox', { name: 'Verniz gel' })).not.toBeChecked();

    // The dead token is cleared, not left behind to be retried forever.
    await expect.poll(() => page.evaluate((k) => window.localStorage.getItem(k), key)).toBeNull();
  });

  test('rejects an expired draft and deletes it from booking_drafts (limpeza)', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex052');
    const tenantId = await publishTenantWithOneService(user);

    const key = draftStorageKey(user.slug);
    await page.goto(`/b/${user.slug}/servicos`);
    await selectFirstService(page);
    await selectFirstSlot(page);
    await completeRegistration(page, 'Beatriz Cliente', '922222222');
    await waitForDraftToken(page, key);
    const token = await page.evaluate((k) => window.localStorage.getItem(k), key);

    const rowHash = hashResumeToken(token!);
    const { data: draftBefore } = await user.admin
      .from('booking_drafts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('resume_token_hash', rowHash)
      .single();
    expect(draftBefore).not.toBeNull();

    // Force expiry without needing the encryption key in the test process — only the
    // timestamp is touched, never the encrypted payload.
    await user.admin
      .from('booking_drafts')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', draftBefore!.id);

    // Drop the same-tab cache so the reload actually falls through to the DB-backed
    // resume token instead of trusting sessionStorage — see sessionStateKey above.
    await page.evaluate((k) => window.sessionStorage.removeItem(k), sessionStateKey(user.slug));
    await page.reload();

    // The expired draft is rejected on resume: with no selection left to show, /resumo
    // sends the visitor back to a fresh /servicos instead of the confirm screen.
    await expect(page).toHaveURL(new RegExp(`/b/${user.slug}/servicos$`));
    await expect(page.getByRole('checkbox', { name: 'Verniz gel' })).not.toBeChecked();

    const { data: draftAfter } = await user.admin
      .from('booking_drafts')
      .select('id')
      .eq('id', draftBefore!.id)
      .maybeSingle();
    expect(draftAfter).toBeNull();
  });
});

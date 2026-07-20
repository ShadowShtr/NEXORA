import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  canUseSupabase,
  cleanupProvisionedTestUser,
  createProvisionedTestUser,
  type ProvisionedTestUser,
} from './support/provisioned-user';
import { completeRegistration } from './support/public-page';

// Mirrors src/lib/booking-draft-crypto.ts#hashResumeToken exactly (SHA-256 hex) — kept
// local instead of importing the `@/lib` alias, matching the other e2e specs, which
// never import app internals directly.
function hashResumeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function draftStorageKey(slug: string) {
  return `nexora-draft-${slug}`;
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
// expired draft is both rejected and deleted from booking_drafts ("limpeza").
test.describe('public booking draft recovery (NEX-052)', () => {
  test.skip(!canUseSupabase(), 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  let user: ProvisionedTestUser;

  test.afterEach(async () => {
    await cleanupProvisionedTestUser(user);
  });

  test('resumes registration and selection on reload, on the same device, with no e-mail step', async ({
    page,
  }) => {
    user = await createProvisionedTestUser('nex052');
    await publishTenantWithOneService(user);

    const key = draftStorageKey(user.slug);
    await page.goto(`/b/${user.slug}`);
    await page.getByRole('checkbox', { name: 'Verniz gel' }).check();
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await page.locator('.public-slot-picker .public-slot-button').first().click();
    await completeRegistration(page, 'Ana Cliente', '911111111');
    await waitForDraftToken(page, key);

    const tokenBeforeReload = await page.evaluate((k) => window.localStorage.getItem(k), key);
    expect(tokenBeforeReload).not.toBeNull();

    await page.reload();

    // Straight back to the selection, registration already resumed — the
    // pre-registration form doesn't gate anything anymore, but its resumed state
    // (name/phone) shows immediately once the service+slot selection is redone.
    await expect(page.getByRole('checkbox', { name: 'Verniz gel' })).toBeChecked();
    await expect(page.getByText('Total: 25,00 € · 60 min')).toBeVisible();
    await page.locator('.public-slot-picker .public-slot-button').first().click();
    await expect(page.getByText('Ana Cliente · +351911111111')).toBeVisible();

    // Editing the resumed draft reuses the same row/token instead of creating a new
    // one (saveBookingDraft's existingToken parameter) — no orphaned rows left behind.
    await page.getByRole('checkbox', { name: 'Verniz gel' }).uncheck();
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

    const response = await page.goto(`/b/${user.slug}`);
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
    await page.goto(`/b/${user.slug}`);
    await page.getByRole('checkbox', { name: 'Verniz gel' }).check();
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await page.locator('.public-slot-picker .public-slot-button').first().click();
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

    await page.reload();

    // The expired draft is rejected on resume, so the cart starts empty again — no
    // service pre-checked, unlike a valid resume.
    await expect(page.getByRole('checkbox', { name: 'Verniz gel' })).not.toBeChecked();

    const { data: draftAfter } = await user.admin
      .from('booking_drafts')
      .select('id')
      .eq('id', draftBefore!.id)
      .maybeSingle();
    expect(draftAfter).toBeNull();
  });
});

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';

// NEX-175: "Load/concurrency test — Booking e availability sob carga alvo."
// Proportional to a solo professional's booking page, not an enterprise load test
// (CLAUDE.md: "Não expandir o escopo"). Requires a running production server
// (`npm run build && npm run start`) and the same Supabase credentials already used
// for local dev (.env.local) — never point this at a real production project.
//
// Server Actions (getPublicAvailability, createPublicBooking) aren't plain REST
// endpoints — Next.js compiles each into a content-hashed `Next-Action` id, called via
// a POST to the page URL with a JSON-array body matching the action's own argument
// list, and replies with a small line-based RSC protocol (a `0:` metadata line, then a
// `1:{...}` line holding this app's own `Result<T>` shape). This script drives one real
// browser flow first to learn the current build's action ids/response shape (they
// change between builds), then replays the same request shape directly via raw fetch
// for the actual concurrent load — far cheaper than spinning up N full browser
// contexts, while still exercising the exact same code path a real visitor's browser
// would (validation, rate limiting, RLS, the appointments_no_overlap exclusion
// constraint), not a re-implementation of it.
//
// Usage:
//   node scripts/load-test.mjs [--concurrency 20] [--base-url http://localhost:3000] --apply
// Dry run (prints the plan, no requests) unless --apply is passed.

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

const apply = process.argv.includes('--apply');
const concurrency = Number(arg('concurrency', '20'));
const baseUrl = arg('base-url', 'http://localhost:3000');

console.log(
  `Plano: provisionar 1 tenant de teste, medir latência de ${concurrency} pedidos concorrentes de disponibilidade, ${concurrency} tentativas de marcação em slots diferentes (throughput) e min(${concurrency}, 10) tentativas concorrentes no MESMO slot (contenção), contra ${baseUrl}. Reverte tudo no fim.`,
);
if (!apply) {
  console.log('\nDry run. Execute com --apply para aplicar de facto.');
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}
const admin = createClient(url, serviceRoleKey);

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return null;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

function report(label, latenciesMs, successCount, total) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  console.log(`\n--- ${label} ---`);
  console.log(`sucesso: ${successCount}/${total}`);
  console.log(
    `p50: ${percentile(sorted, 50)}ms  p95: ${percentile(sorted, 95)}ms  p99: ${percentile(sorted, 99)}ms`,
  );
  console.log(`min: ${sorted[0]}ms  max: ${sorted[sorted.length - 1]}ms`);
  return {
    label,
    successCount,
    total,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
  };
}

async function main() {
  const tenantSlug = `loadtest-${randomUUID().slice(0, 8)}`;
  const email = `loadtest-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;

  console.log('\n--- setup ---');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const { data: tenantId, error: rpcError } = await admin.rpc('provision_tenant_owner', {
    p_user_id: created.data.user.id,
    p_slug: tenantSlug,
    p_business_name: 'Load Test',
    p_owner_display_name: 'Owner',
  });
  if (rpcError) throw rpcError;

  await admin
    .from('business_settings')
    .update({
      phone_e164: '+351910000000',
      published_at: new Date().toISOString(),
      min_notice_hours: 1,
    })
    .eq('tenant_id', tenantId);
  await admin.from('tenants').update({ status: 'active' }).eq('id', tenantId);
  // Open every day, effectively all day — the point is having far more distinct slots
  // available than the concurrency level needs, not modelling a realistic schedule.
  await admin.from('business_hours').insert(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '00:00',
      closes_at: '23:30',
    })),
  );
  const { data: category } = await admin
    .from('service_categories')
    .insert({ tenant_id: tenantId, name: 'Manicure' })
    .select('id')
    .single();
  const { data: service } = await admin
    .from('services')
    .insert({
      tenant_id: tenantId,
      category_id: category.id,
      name: 'Verniz gel',
      price_cents: 2500,
      duration_minutes: 30,
    })
    .select('id')
    .single();
  console.log(`tenant ${tenantId} (${tenantSlug}), serviço ${service.id}`);

  try {
    // --- Phase 1: one real browser pass to learn this build's action ids + response shape ---
    console.log('\n--- fase 1: descobrir Next-Action ids reais (1 marcação real via browser) ---');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const captured = [];
    page.on('request', (req) => {
      const actionId = req.headers()['next-action'];
      if (req.method() === 'POST' && actionId) {
        captured.push({ url: req.url(), actionId, postData: req.postData() });
      }
    });

    await page.goto(`${baseUrl}/b/${tenantSlug}/servicos`);
    await page.locator('.public-service-choice input[type="checkbox"]').first().check();
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await page.waitForURL(/\/horario$/);
    await page
      .locator('.public-slot-picker .public-slot-button')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.public-slot-picker .public-slot-button').first().click();
    await page.locator('.public-cart-bar').getByRole('button', { name: 'Continuar' }).click();
    await page.waitForURL(/\/dados$/);
    await page.getByLabel('O seu nome').fill('Descoberta');
    await page.getByLabel('Telemóvel').fill('900000000');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForURL(/\/resumo$/);
    await page.getByRole('button', { name: 'Confirmar marcação' }).waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar marcação' }).click();
    await page.waitForTimeout(2000);
    await browser.close();

    function safeParse(text) {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    console.log(
      'pedidos capturados:',
      captured.map((c) => ({ url: c.url, actionId: c.actionId, postData: c.postData })),
    );
    const availabilityAction = captured.find(
      (c) => c.url.endsWith('/horario') && typeof safeParse(c.postData)?.[0]?.tenantId === 'string',
    )?.actionId;
    const bookingAction = captured.find((c) => c.url.endsWith('/resumo'))?.actionId;
    if (!availabilityAction || !bookingAction) {
      throw new Error('Não foi possível descobrir os Next-Action ids — a UI pode ter mudado.');
    }
    console.log(`availability action: ${availabilityAction}\nbooking action: ${bookingAction}`);

    function actionHeaders(actionId) {
      return { 'Content-Type': 'text/plain;charset=UTF-8', 'Next-Action': actionId };
    }

    // A real Result<T> response is on the line starting with "1:" — see module comment.
    function parseActionResult(text) {
      const line = text.split('\n').find((l) => l.startsWith('1:'));
      if (!line) return null;
      try {
        return JSON.parse(line.slice(2));
      } catch {
        return null;
      }
    }

    // --- Phase 2: availability under concurrent load ---
    console.log(`\n--- fase 2: disponibilidade, ${concurrency} pedidos concorrentes ---`);
    const availabilityResults = await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const start = performance.now();
        const res = await fetch(`${baseUrl}/b/${tenantSlug}/horario`, {
          method: 'POST',
          headers: actionHeaders(availabilityAction),
          body: JSON.stringify([{ tenantId, serviceDurationMinutes: 30 }]),
        });
        const text = await res.text();
        const elapsed = performance.now() - start;
        const result = parseActionResult(text);
        return { elapsed, ok: result?.ok === true, slotsIso: result?.value?.slotsIso ?? [] };
      }),
    );
    const availabilityReport = report(
      'Disponibilidade (concorrente)',
      availabilityResults.map((r) => r.elapsed),
      availabilityResults.filter((r) => r.ok).length,
      concurrency,
    );
    const allAvailableSlots =
      availabilityResults.find((r) => r.slotsIso.length > 0)?.slotsIso ?? [];
    // Adjacent entries in the availability list are only slot_interval_minutes apart
    // (30 here), but booking one blocks duration + buffer_minutes going forward (30 +
    // 15 = 45 here, docs/04_DATA_MODEL.md) — two "available" neighbours booked at the
    // same instant can legitimately collide via the buffer, which isn't a throughput
    // limit, it's appointments_no_overlap doing exactly its job. Skipping every other
    // slot guarantees ≥60 min spacing, safely over the 45 min actually needed, so
    // "throughput" below measures independent bookings, not buffer contention.
    const throughputSlots = allAvailableSlots.filter((_, i) => i % 2 === 0);
    if (throughputSlots.length < concurrency || allAvailableSlots.length < 2 * concurrency + 6) {
      throw new Error(
        `Poucos slots disponíveis (${allAvailableSlots.length} no total) para o nível de concorrência pedido — aumente a janela de disponibilidade do tenant de teste.`,
      );
    }

    // --- Phase 3: booking throughput — each request targets a DIFFERENT slot ---
    console.log(
      `\n--- fase 3: marcação, ${concurrency} pedidos concorrentes, slots diferentes ---`,
    );
    function bookingBody({ startAtIso, phoneSuffix }) {
      return JSON.stringify([
        {
          tenantId,
          registration: { name: 'Carga', phone: `+35191${phoneSuffix}`, email: '' },
          selectedServiceIds: [service.id],
          selectedPackageId: null,
          startAtIso,
          idempotencyKey: randomBytes(32).toString('hex'),
          observation: '$undefined',
          turnstileToken: '$undefined',
        },
      ]);
    }
    const throughputResults = await Promise.all(
      Array.from({ length: concurrency }, async (_, i) => {
        const start = performance.now();
        const res = await fetch(`${baseUrl}/b/${tenantSlug}/resumo`, {
          method: 'POST',
          headers: actionHeaders(bookingAction),
          body: bookingBody({ startAtIso: throughputSlots[i], phoneSuffix: String(1000000 + i) }),
        });
        const text = await res.text();
        const elapsed = performance.now() - start;
        const result = parseActionResult(text);
        return { elapsed, ok: result?.ok === true };
      }),
    );
    const throughputReport = report(
      'Marcação — slots diferentes (throughput)',
      throughputResults.map((r) => r.elapsed),
      throughputResults.filter((r) => r.ok).length,
      concurrency,
    );

    // --- Phase 4: booking contention — every request targets the SAME slot ---
    const contentionCount = Math.min(concurrency, 10);
    console.log(
      `\n--- fase 4: marcação, ${contentionCount} pedidos concorrentes, MESMO slot (contenção) ---`,
    );
    // Clear of every slot phase 3 touched (and its buffer), plus margin — this phase
    // wants its own uncontended-by-anything-else slot, contended only by itself.
    const contendedSlot = allAvailableSlots[2 * concurrency + 5];
    const contentionResults = await Promise.all(
      Array.from({ length: contentionCount }, async (_, i) => {
        const start = performance.now();
        const res = await fetch(`${baseUrl}/b/${tenantSlug}/resumo`, {
          method: 'POST',
          headers: actionHeaders(bookingAction),
          body: bookingBody({ startAtIso: contendedSlot, phoneSuffix: String(2000000 + i) }),
        });
        const text = await res.text();
        const elapsed = performance.now() - start;
        const result = parseActionResult(text);
        return { elapsed, ok: result?.ok === true, code: result?.error?.code };
      }),
    );
    const contentionReport = report(
      'Marcação — mesmo slot (contenção)',
      contentionResults.map((r) => r.elapsed),
      contentionResults.filter((r) => r.ok).length,
      contentionCount,
    );
    const slotTakenCount = contentionResults.filter((r) => r.code === 'SLOT_TAKEN').length;
    console.log(
      `esperado: exatamente 1 sucesso, ${contentionCount - 1} SLOT_TAKEN — obtido: ${contentionReport.successCount} sucesso(s), ${slotTakenCount} SLOT_TAKEN`,
    );
    if (contentionReport.successCount !== 1) {
      console.error(
        '⚠ FALHA DE CORREÇÃO: mais ou menos de 1 marcação venceu a contenção pelo mesmo slot — investigar antes de considerar isto passado.',
      );
    }

    console.log('\n--- resumo ---');
    console.log(
      JSON.stringify(
        { concurrency, availabilityReport, throughputReport, contentionReport },
        null,
        2,
      ),
    );
  } finally {
    console.log('\n--- cleanup ---');
    await admin.from('appointments').delete().eq('tenant_id', tenantId);
    await admin.from('clients').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').update({ status: 'deleted' }).eq('id', tenantId);
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(created.data.user.id);
    if (deleteUserError) {
      // Esperado: provision_tenant_owner/publish_business escrevem em audit_logs, que
      // tem FK RESTRICT para o autor (ADR/NEX-172-era fix). O utilizador de teste fica
      // órfão em auth.users mas o tenant já está soft-deleted e sem dados associados.
      console.warn(
        `aviso: não foi possível apagar o utilizador de teste ${created.data.user.id} (esperado — audit_logs referencia o autor): ${deleteUserError.message}`,
      );
    }
    console.log('done');
  }
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});

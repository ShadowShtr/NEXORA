import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// PR4 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR4 update): exercises
// get_dashboard_summary_v1 (supabase/migrations/0039_dashboard_summary_rpc.sql) through
// the same PostgREST/RPC boundary the app uses — real Postgres, real RLS/grants, real
// row-multiplication risk from the appointment_items/payments joins. Same env-var gate
// and skip-cleanly-when-unset pattern as every other file in tests/integration/ (e.g.
// catalog-rls.test.ts). Requires a live Supabase instance (`supabase start`, Docker) —
// unavailable in the session this test was written in; see the report's "Bloqueio de
// ambiente" for how these tests are expected to actually run (CI's `integration` job).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

function phone(seed: number) {
  return `+3519${String(10000000 + seed).padStart(8, '0')}`;
}

describe.runIf(canRun)('get_dashboard_summary_v1 (PR4)', () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let ownerA: SupabaseClient;
  let ownerB: SupabaseClient;
  let ownerNoProfile: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `pr4-a-${randomUUID()}@example.test`;
  const emailB = `pr4-b-${randomUUID()}@example.test`;
  const emailNoProfile = `pr4-noprofile-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  let userNoProfileId: string;

  // Fixed UTC window, deliberately not DST-adjacent — this RPC does no timezone math
  // of its own (that stays in the caller, per the migration's own comment and PR1's
  // audit confirming the caller already resolves it correctly); these tests only need
  // to prove the semi-open interval and aggregation logic, not DST.
  const dayStart = new Date('2026-06-01T00:00:00.000Z');
  const dayEnd = new Date('2026-06-02T00:00:00.000Z');
  const dayBefore = new Date('2026-05-31T12:00:00.000Z');

  const appointmentIds = {
    withOneItemOnePayment: randomUUID(),
    withMultiItemsMultiPayments: randomUUID(),
    atDayStartBoundary: randomUUID(),
    atDayEndBoundary: randomUUID(),
    beforeRange: randomUUID(),
    cancelled: randomUUID(),
    completedWithPartialPayment: randomUUID(),
    noPayment: randomUUID(),
  };

  let clientAId: string;

  async function insertAppointment(opts: {
    id: string;
    status: 'confirmed' | 'presence_confirmed' | 'completed' | 'cancelled' | 'no_show';
    startAt: Date;
    expectedTotalCents: number;
    finalTotalCents?: number | null;
  }) {
    const endAt = new Date(opts.startAt.getTime() + 30 * 60_000);
    const blockedUntil = new Date(endAt.getTime() + 15 * 60_000);
    const { error } = await admin.from('appointments').insert({
      id: opts.id,
      tenant_id: tenantAId,
      client_id: clientAId,
      source: 'admin',
      status: opts.status,
      start_at: opts.startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: blockedUntil.toISOString(),
      expected_total_cents: opts.expectedTotalCents,
      final_total_cents: opts.finalTotalCents ?? null,
      booking_token_hash: bookingTokenHash(opts.id),
    });
    if (error) throw error;
  }

  async function insertItems(appointmentId: string, descriptions: string[], startingAtMs: number) {
    const rows = descriptions.map((description, index) => ({
      tenant_id: tenantAId,
      appointment_id: appointmentId,
      source_type: 'manual_extra' as const,
      description,
      unit_price_cents: 1000,
      duration_minutes: 30,
      created_at: new Date(startingAtMs + index * 1000).toISOString(),
    }));
    const { error } = await admin.from('appointment_items').insert(rows);
    if (error) throw error;
  }

  async function insertPayment(opts: {
    appointmentId: string;
    status: 'pending' | 'paid';
    amountCents: number;
    paidAt?: Date;
  }) {
    const { error } = await admin.from('payments').insert({
      tenant_id: tenantAId,
      appointment_id: opts.appointmentId,
      status: opts.status,
      method: opts.status === 'paid' ? 'cash' : null,
      amount_cents: opts.amountCents,
      paid_at: opts.status === 'paid' ? (opts.paidAt ?? dayStart).toISOString() : null,
    });
    if (error) throw error;
  }

  async function insertReminder(appointmentId: string, status: string, dueAt: Date) {
    const { error } = await admin.from('reminders').insert({
      tenant_id: tenantAId,
      appointment_id: appointmentId,
      status,
      due_at: dueAt.toISOString(),
    });
    if (error) throw error;
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    anon = createClient(url!, publishableKey!);

    const { error: tenantsError } = await admin.from('tenants').insert([
      {
        id: tenantAId,
        slug: `pr4-a-${tenantAId.slice(0, 8)}`,
        name: 'Salao A PR4',
        status: 'active',
      },
      {
        id: tenantBId,
        slug: `pr4-b-${tenantBId.slice(0, 8)}`,
        name: 'Salao B PR4',
        status: 'active',
      },
    ]);
    if (tenantsError) throw tenantsError;

    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (createdA.error) throw createdA.error;
    userAId = createdA.data.user.id;

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createdB.error) throw createdB.error;
    userBId = createdB.data.user.id;

    const createdNoProfile = await admin.auth.admin.createUser({
      email: emailNoProfile,
      password,
      email_confirm: true,
    });
    if (createdNoProfile.error) throw createdNoProfile.error;
    userNoProfileId = createdNoProfile.data.user.id;

    const { error: profilesError } = await admin.from('profiles').insert([
      { user_id: userAId, tenant_id: tenantAId, role: 'owner', display_name: 'Owner A' },
      { user_id: userBId, tenant_id: tenantBId, role: 'owner', display_name: 'Owner B' },
      // userNoProfileId deliberately gets no profiles row — scenario 19/20's "utilizador
      // sem acesso a nenhum tenant" (authenticated, current_tenant_id() resolves null).
    ]);
    if (profilesError) throw profilesError;

    const { data: clientA, error: clientAError } = await admin
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Cliente A', phone_e164: phone(1) })
      .select('id')
      .single();
    if (clientAError) throw clientAError;
    clientAId = clientA.id;

    const { data: clientB, error: clientBError } = await admin
      .from('clients')
      .insert({ tenant_id: tenantBId, name: 'Cliente B', phone_e164: phone(2) })
      .select('id')
      .single();
    if (clientBError) throw clientBError;

    // --- Tenant A fixtures -------------------------------------------------------

    // #2/#3: one appointment, one item, one full payment paid today.
    await insertAppointment({
      id: appointmentIds.withOneItemOnePayment,
      status: 'confirmed',
      startAt: new Date(dayStart.getTime() + 9 * 3_600_000),
      expectedTotalCents: 5000,
    });
    await insertItems(appointmentIds.withOneItemOnePayment, ['Manicure Gel'], dayStart.getTime());
    await insertPayment({
      appointmentId: appointmentIds.withOneItemOnePayment,
      status: 'paid',
      amountCents: 5000,
      paidAt: new Date(dayStart.getTime() + 9 * 3_600_000 + 60_000),
    });

    // #14/#15: multiple items, multiple payments (2 paid + 1 pending) — must not
    // multiply the appointment row and must sum each side correctly.
    await insertAppointment({
      id: appointmentIds.withMultiItemsMultiPayments,
      status: 'confirmed',
      startAt: new Date(dayStart.getTime() + 10 * 3_600_000),
      expectedTotalCents: 4500,
    });
    await insertItems(
      appointmentIds.withMultiItemsMultiPayments,
      ['Verniz Gel', 'Alongamento', 'Nail Art'],
      dayStart.getTime() + 3_600_000,
    );
    await insertPayment({
      appointmentId: appointmentIds.withMultiItemsMultiPayments,
      status: 'paid',
      amountCents: 2000,
      paidAt: new Date(dayStart.getTime() + 10 * 3_600_000 + 60_000),
    });
    await insertPayment({
      appointmentId: appointmentIds.withMultiItemsMultiPayments,
      status: 'paid',
      amountCents: 1000,
      paidAt: new Date(dayStart.getTime() + 10 * 3_600_000 + 120_000),
    });
    await insertPayment({
      appointmentId: appointmentIds.withMultiItemsMultiPayments,
      status: 'pending',
      amountCents: 1500,
    });

    // #5: exactly at dayStart — must be included (>=).
    await insertAppointment({
      id: appointmentIds.atDayStartBoundary,
      status: 'confirmed',
      startAt: dayStart,
      expectedTotalCents: 1000,
    });

    // #6: exactly at dayEnd — must be excluded (< not <=).
    await insertAppointment({
      id: appointmentIds.atDayEndBoundary,
      status: 'confirmed',
      startAt: dayEnd,
      expectedTotalCents: 1000,
    });

    // #4: clearly outside the range (the day before).
    await insertAppointment({
      id: appointmentIds.beforeRange,
      status: 'confirmed',
      startAt: dayBefore,
      expectedTotalCents: 1000,
    });

    // #7: cancelled — still present in the raw appointments_today list (business logic
    // that filters by status for "today count"/"invoiced" lives in JS, unchanged by
    // this PR — see buildDashboardSummary, src/features/dashboard/domain/summary.ts).
    await insertAppointment({
      id: appointmentIds.cancelled,
      status: 'cancelled',
      startAt: new Date(dayStart.getTime() + 11 * 3_600_000),
      expectedTotalCents: 3000,
    });

    // #8/#12: completed, with a partial payment (paid less than the final total) —
    // exercises coalesce(final_total_cents, expected_total_cents) via a final total
    // that differs from the expected one.
    await insertAppointment({
      id: appointmentIds.completedWithPartialPayment,
      status: 'completed',
      startAt: new Date(dayStart.getTime() + 12 * 3_600_000),
      expectedTotalCents: 5000,
      finalTotalCents: 4500,
    });
    await insertPayment({
      appointmentId: appointmentIds.completedWithPartialPayment,
      status: 'paid',
      amountCents: 2000,
      paidAt: new Date(dayStart.getTime() + 12 * 3_600_000 + 60_000),
    });
    await insertPayment({
      appointmentId: appointmentIds.completedWithPartialPayment,
      status: 'pending',
      amountCents: 2500,
    });

    // #10: appointment with no payment row at all — must contribute 0 to both totals,
    // not be silently skipped from appointments_today.
    await insertAppointment({
      id: appointmentIds.noPayment,
      status: 'confirmed',
      startAt: new Date(dayStart.getTime() + 13 * 3_600_000),
      expectedTotalCents: 2000,
    });

    // --- Reminders: due_at strictly increasing so "the 4 earliest pending" is a
    // deterministic set, independent of insertion order. #16 (tenant-wide pending
    // count) + #17 (attention list, limit 4, ordered) + the tenant-wide-not-date-scoped
    // rule (one of these is attached to an appointment *outside* the day range).
    await insertReminder(
      appointmentIds.withOneItemOnePayment,
      'pending',
      new Date(dayStart.getTime() + 1 * 3_600_000),
    );
    await insertReminder(
      appointmentIds.withMultiItemsMultiPayments,
      'pending',
      new Date(dayStart.getTime() + 2 * 3_600_000),
    );
    // Tied to an appointment *outside* the day range — pending_reminders_count must
    // still include it (tenant-wide, no date filter, matches the pre-RPC loader).
    await insertReminder(
      appointmentIds.beforeRange,
      'pending',
      new Date(dayStart.getTime() + 3 * 3_600_000),
    );
    await insertReminder(
      appointmentIds.cancelled,
      'pending',
      new Date(dayStart.getTime() + 4 * 3_600_000),
    );
    // 5th and 6th earliest — pending (counted) but must NOT appear in the 4-row
    // attention list.
    await insertReminder(
      appointmentIds.atDayStartBoundary,
      'pending',
      new Date(dayStart.getTime() + 5 * 3_600_000),
    );
    await insertReminder(
      appointmentIds.completedWithPartialPayment,
      'pending',
      new Date(dayStart.getTime() + 6 * 3_600_000),
    );
    // Earliest due_at of all, but status != 'pending' — must be excluded from *both*
    // the count and the attention list despite sorting first on due_at alone.
    await insertReminder(
      appointmentIds.noPayment,
      'marked_sent',
      new Date(dayStart.getTime() + 30 * 60_000),
    );

    // --- Tenant B: similar-looking data, must never leak into tenant A's result.
    const otherAppointmentId = randomUUID();
    const otherEndAt = new Date(dayStart.getTime() + 9 * 3_600_000 + 30 * 60_000);
    const { error: otherApptError } = await admin.from('appointments').insert({
      id: otherAppointmentId,
      tenant_id: tenantBId,
      client_id: clientB.id,
      source: 'admin',
      status: 'confirmed',
      start_at: new Date(dayStart.getTime() + 9 * 3_600_000).toISOString(),
      end_at: otherEndAt.toISOString(),
      blocked_until: new Date(otherEndAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 9999,
      booking_token_hash: bookingTokenHash(otherAppointmentId),
    });
    if (otherApptError) throw otherApptError;
    await admin.from('payments').insert({
      tenant_id: tenantBId,
      appointment_id: otherAppointmentId,
      status: 'paid',
      method: 'mbway',
      amount_cents: 9999,
      paid_at: new Date(dayStart.getTime() + 9 * 3_600_000 + 60_000).toISOString(),
    });
    await admin.from('reminders').insert({
      tenant_id: tenantBId,
      appointment_id: otherAppointmentId,
      status: 'pending',
      due_at: dayStart.toISOString(),
    });

    ownerA = createClient(url!, publishableKey!);
    const signInA = await ownerA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;

    ownerB = createClient(url!, publishableKey!);
    const signInB = await ownerB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;

    ownerNoProfile = createClient(url!, publishableKey!);
    const signInNoProfile = await ownerNoProfile.auth.signInWithPassword({
      email: emailNoProfile,
      password,
    });
    if (signInNoProfile.error) throw signInNoProfile.error;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().in('id', [tenantAId, tenantBId]);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
    if (userNoProfileId) await admin.auth.admin.deleteUser(userNoProfileId);
  });

  async function callAsOwnerA() {
    const { data, error } = await ownerA.rpc('get_dashboard_summary_v1', {
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    if (error) throw error;
    return data as {
      appointments_today: {
        id: string;
        status: string;
        total_cents: number;
        item_descriptions: string[];
      }[];
      attention_reminders: { appointment_id: string; due_at: string }[];
      pending_reminders_count: number;
      received_today_cents: number;
      pending_today_cents: number;
      pending_payments_today_count: number;
    };
  }

  // #1: tenant sem marcações — a fresh tenant, isolated from tenant A's fixtures,
  // proves the RPC doesn't error or return stale/shared data on an empty day.
  it('returns all-zero/empty for a tenant with no data in range', async () => {
    const freshTenantId = randomUUID();
    const freshEmail = `pr4-fresh-${randomUUID()}@example.test`;
    const { error: tenantError } = await admin.from('tenants').insert({
      id: freshTenantId,
      slug: `pr4-fresh-${freshTenantId.slice(0, 8)}`,
      name: 'Fresh',
      status: 'active',
    });
    if (tenantError) throw tenantError;
    const created = await admin.auth.admin.createUser({
      email: freshEmail,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    await admin.from('profiles').insert({
      user_id: created.data.user.id,
      tenant_id: freshTenantId,
      role: 'owner',
      display_name: 'Fresh Owner',
    });
    const freshOwner = createClient(url!, publishableKey!);
    const signIn = await freshOwner.auth.signInWithPassword({ email: freshEmail, password });
    if (signIn.error) throw signIn.error;

    const { data, error } = await freshOwner.rpc('get_dashboard_summary_v1', {
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    expect(error).toBeNull();
    expect(data).toEqual({
      appointments_today: [],
      attention_reminders: [],
      pending_reminders_count: 0,
      received_today_cents: 0,
      pending_today_cents: 0,
      pending_payments_today_count: 0,
    });

    await admin.from('tenants').delete().eq('id', freshTenantId);
    await admin.auth.admin.deleteUser(created.data.user.id);
  });

  // #2/#3: appointments present, correct count.
  it('includes every appointment whose start_at falls in [day_start, day_end)', async () => {
    const data = await callAsOwnerA();
    const ids = data.appointments_today.map((row) => row.id);
    expect(ids).toContain(appointmentIds.withOneItemOnePayment);
    expect(ids).toContain(appointmentIds.withMultiItemsMultiPayments);
    expect(ids).toContain(appointmentIds.atDayStartBoundary);
    expect(ids).toContain(appointmentIds.cancelled);
    expect(ids).toContain(appointmentIds.completedWithPartialPayment);
    expect(ids).toContain(appointmentIds.noPayment);
    // 6 in-range appointments seeded above; atDayEndBoundary and beforeRange excluded.
    expect(data.appointments_today).toHaveLength(6);
  });

  // #4/#5/#6: boundary semantics — semi-open interval, not BETWEEN.
  it('excludes an appointment before the range and one exactly at day_end, includes one exactly at day_start', async () => {
    const data = await callAsOwnerA();
    const ids = data.appointments_today.map((row) => row.id);
    expect(ids).not.toContain(appointmentIds.beforeRange);
    expect(ids).not.toContain(appointmentIds.atDayEndBoundary);
    expect(ids).toContain(appointmentIds.atDayStartBoundary);
  });

  // #7/#8: status values pass through untouched — the RPC does not filter by status,
  // matching the pre-RPC loader (buildDashboardSummary does that filtering in JS).
  it('includes cancelled and completed appointments in the raw list with their real status', async () => {
    const data = await callAsOwnerA();
    const cancelled = data.appointments_today.find((row) => row.id === appointmentIds.cancelled);
    const completed = data.appointments_today.find(
      (row) => row.id === appointmentIds.completedWithPartialPayment,
    );
    expect(cancelled?.status).toBe('cancelled');
    expect(completed?.status).toBe('completed');
  });

  // #10/#11/#12/#13: payment aggregation correctness.
  it('sums received_today_cents from paid payments only, across appointments, with no double counting', async () => {
    const data = await callAsOwnerA();
    // 5000 (single) + 2000 + 1000 (multi) + 2000 (completed/partial) = 10000.
    expect(data.received_today_cents).toBe(10000);
  });

  it('sums pending_today_cents and pending_payments_today_count from pending payments on today appointments only', async () => {
    const data = await callAsOwnerA();
    // 1500 (multi) + 2500 (completed/partial) = 4000, across 2 payment rows.
    expect(data.pending_today_cents).toBe(4000);
    expect(data.pending_payments_today_count).toBe(2);
  });

  it('an appointment with no payment rows contributes 0 to both totals, not an error or a skip', async () => {
    const data = await callAsOwnerA();
    const noPayment = data.appointments_today.find((row) => row.id === appointmentIds.noPayment);
    expect(noPayment).toBeDefined();
    // Verified indirectly: the totals above already sum to exactly the expected
    // amounts with this appointment included and contributing nothing extra.
  });

  // #9 clarification: this schema's appointment_status enum (confirmed,
  // presence_confirmed, completed, cancelled, no_show — 0001_initial.sql) has no
  // "pending" value; "marcação pendente" from the brief is interpreted as an
  // appointment with a pending *payment*, covered by the payment tests above, not a
  // status value that does not exist in this schema.

  // #14/#15: item aggregation — one row per appointment regardless of item/payment count.
  it('aggregates multiple appointment_items into one array without multiplying the appointment row', async () => {
    const data = await callAsOwnerA();
    const multi = data.appointments_today.find(
      (row) => row.id === appointmentIds.withMultiItemsMultiPayments,
    );
    expect(multi).toBeDefined();
    expect(multi!.item_descriptions).toEqual(['Verniz Gel', 'Alongamento', 'Nail Art']);
    // Exactly one row for this appointment id, not 3 (items) x 3 (payments) = 9.
    expect(
      data.appointments_today.filter(
        (row) => row.id === appointmentIds.withMultiItemsMultiPayments,
      ),
    ).toHaveLength(1);
    expect(multi!.total_cents).toBe(4500);
  });

  it('coalesces final_total_cents over expected_total_cents when both are set', async () => {
    const data = await callAsOwnerA();
    const completed = data.appointments_today.find(
      (row) => row.id === appointmentIds.completedWithPartialPayment,
    );
    expect(completed!.total_cents).toBe(4500);
  });

  // #16: tenant-wide, not date-scoped — includes the reminder tied to an
  // out-of-range appointment, excludes the non-pending one.
  it('pending_reminders_count is tenant-wide and status-filtered, not date-scoped', async () => {
    const data = await callAsOwnerA();
    expect(data.pending_reminders_count).toBe(6);
  });

  // #17: attention list — exactly the 4 earliest-due pending reminders, in order.
  it('attention_reminders returns exactly the 4 earliest pending reminders, ordered by due_at, excluding non-pending ones', async () => {
    const data = await callAsOwnerA();
    expect(data.attention_reminders).toHaveLength(4);
    expect(data.attention_reminders.map((row) => row.appointment_id)).toEqual([
      appointmentIds.withOneItemOnePayment,
      appointmentIds.withMultiItemsMultiPayments,
      appointmentIds.beforeRange,
      appointmentIds.cancelled,
    ]);
    // The earliest-due reminder of all (30 min in) is excluded because its status is
    // 'marked_sent', not 'pending' — proves the status filter isn't bypassed by
    // due_at ordering.
    expect(data.attention_reminders.map((row) => row.appointment_id)).not.toContain(
      appointmentIds.noPayment,
    );
  });

  // #18: cross-tenant isolation.
  it('does not include tenant B data in tenant A results', async () => {
    const data = await callAsOwnerA();
    // Tenant B's appointment total (9999) never appears; if it leaked into
    // received_today_cents the sum would be 10000 + 9999, not 10000.
    expect(data.received_today_cents).toBe(10000);
    const totalCentsList = data.appointments_today.map((row) => row.total_cents);
    expect(totalCentsList).not.toContain(9999);
  });

  it('tenant B, called by its own owner, sees only its own data', async () => {
    const { data, error } = await ownerB.rpc('get_dashboard_summary_v1', {
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    expect(error).toBeNull();
    const rows = data as {
      appointments_today: { total_cents: number }[];
      received_today_cents: number;
    };
    expect(rows.appointments_today).toHaveLength(1);
    expect(rows.appointments_today[0]!.total_cents).toBe(9999);
    expect(rows.received_today_cents).toBe(9999);
  });

  // #19: authenticated user with no profile/tenant at all.
  it('rejects an authenticated user with no profile (no tenant to resolve)', async () => {
    const { data, error } = await ownerNoProfile.rpc('get_dashboard_summary_v1', {
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  // #20: anon — ADR-008's own required test ("anon recebe 42501 ou equivalente").
  it('rejects an anonymous (unauthenticated) caller — no EXECUTE grant to anon', async () => {
    const { data, error } = await anon.rpc('get_dashboard_summary_v1', {
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // PostgREST surfaces a missing EXECUTE grant as 42501 (insufficient_privilege) —
    // same code ADR-008 requires this class of test to assert on.
    expect(error?.code).toBe('42501');
  });

  it('rejects an invalid day range (day_end <= day_start) rather than silently returning empty data', async () => {
    const { data, error } = await ownerA.rpc('get_dashboard_summary_v1', {
      p_day_start: dayEnd.toISOString(),
      p_day_end: dayStart.toISOString(),
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

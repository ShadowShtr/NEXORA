import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises mark_reminder_opened / mark_reminder_sent (NEX-103,
// supabase/migrations/0013_reminder_engagement.sql) through the same PostgREST
// boundary the app uses. Requires the same env vars as publish-business.test.ts; skips
// cleanly when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('mark_reminder_opened / mark_reminder_sent (NEX-103)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const emailA = `nex103-a-${randomUUID()}@example.test`;
  const emailB = `nex103-b-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userAId: string;
  let userBId: string;
  const slugA = `nex103-a-${tenantAId.slice(0, 8)}`;
  const slugB = `nex103-b-${tenantBId.slice(0, 8)}`;
  let clientAId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);
    userB = createClient(url!, publishableKey!);

    await admin.from('tenants').insert([
      { id: tenantAId, slug: slugA, name: 'Tenant A', status: 'active' },
      { id: tenantBId, slug: slugB, name: 'Tenant B', status: 'active' },
    ]);
    await admin.from('business_settings').insert([
      { tenant_id: tenantAId, buffer_minutes: 15 },
      { tenant_id: tenantBId, buffer_minutes: 15 },
    ]);

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

    await admin.from('profiles').insert([
      { user_id: userAId, tenant_id: tenantAId, role: 'owner', display_name: 'Owner A' },
      { user_id: userBId, tenant_id: tenantBId, role: 'owner', display_name: 'Owner B' },
    ]);

    const signInA = await userA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;
    const signInB = await userB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantAId, name: 'Client A', phone_e164: '+351910000040' })
      .select('id')
      .single();
    clientAId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').update({ status: 'deleted' }).in('id', [tenantAId, tenantBId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function seedReminder(startAt: Date) {
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const appointmentId = randomUUID();
    const { error: apptError } = await admin.from('appointments').insert({
      id: appointmentId,
      tenant_id: tenantAId,
      client_id: clientAId,
      source: 'admin',
      status: 'confirmed',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 2500,
      booking_token_hash: bookingTokenHash(appointmentId),
    });
    if (apptError) throw apptError;
    const { data: reminder, error: reminderError } = await admin
      .from('reminders')
      .insert({
        tenant_id: tenantAId,
        appointment_id: appointmentId,
        due_at: new Date(startAt.getTime() - 24 * 60 * 60_000).toISOString(),
      })
      .select('id')
      .single();
    if (reminderError) throw reminderError;
    return reminder!.id as string;
  }

  it('mark_reminder_opened is not callable by anon', async () => {
    const anon = createClient(url!, publishableKey!);
    const reminderId = await seedReminder(new Date(Date.now() + 100 * 60 * 60_000));
    const { error } = await anon.rpc('mark_reminder_opened', { p_reminder_id: reminderId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("rejects opening another tenant's reminder", async () => {
    const reminderId = await seedReminder(new Date(Date.now() + 103 * 60 * 60_000));
    const { error } = await userB.rpc('mark_reminder_opened', { p_reminder_id: reminderId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });

  it('moves pending -> opened, sets opened_at, and writes one audit log entry even if clicked twice', async () => {
    const reminderId = await seedReminder(new Date(Date.now() + 106 * 60 * 60_000));

    const first = await userA.rpc('mark_reminder_opened', { p_reminder_id: reminderId });
    expect(first.error).toBeNull();

    const afterFirst = await admin
      .from('reminders')
      .select('status, opened_at')
      .eq('id', reminderId)
      .single();
    expect(afterFirst.data?.status).toBe('opened');
    expect(afterFirst.data?.opened_at).not.toBeNull();

    // Idempotent: a second click is a no-op, opened_at does not move, and no second
    // status transition is recorded (only 'pending' advances, per the RPC's own guard).
    const second = await userA.rpc('mark_reminder_opened', { p_reminder_id: reminderId });
    expect(second.error).toBeNull();

    const afterSecond = await admin
      .from('reminders')
      .select('status, opened_at')
      .eq('id', reminderId)
      .single();
    expect(afterSecond.data?.opened_at).toBe(afterFirst.data?.opened_at);

    const auditCount = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('resource_id', reminderId)
      .eq('action', 'reminder.opened');
    expect(auditCount.count).toBe(1);
  });

  it('marking sent never regresses an already-opened reminder back to pending', async () => {
    const reminderId = await seedReminder(new Date(Date.now() + 109 * 60 * 60_000));
    await userA.rpc('mark_reminder_opened', { p_reminder_id: reminderId });

    const { error } = await userA.rpc('mark_reminder_sent', { p_reminder_id: reminderId });
    expect(error).toBeNull();

    const reminder = await admin
      .from('reminders')
      .select('status, marked_sent_at')
      .eq('id', reminderId)
      .single();
    expect(reminder.data?.status).toBe('marked_sent');
    expect(reminder.data?.marked_sent_at).not.toBeNull();
  });

  it('marking sent twice is idempotent and writes only one audit log entry', async () => {
    const reminderId = await seedReminder(new Date(Date.now() + 112 * 60 * 60_000));

    const first = await userA.rpc('mark_reminder_sent', { p_reminder_id: reminderId });
    expect(first.error).toBeNull();
    const second = await userA.rpc('mark_reminder_sent', { p_reminder_id: reminderId });
    expect(second.error).toBeNull();

    const auditCount = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('resource_id', reminderId)
      .eq('action', 'reminder.marked_sent');
    expect(auditCount.count).toBe(1);
  });

  it('rejects marking a skipped reminder as sent', async () => {
    const reminderId = await seedReminder(new Date(Date.now() + 115 * 60 * 60_000));
    await admin.from('reminders').update({ status: 'skipped' }).eq('id', reminderId);

    const { error } = await userA.rpc('mark_reminder_sent', { p_reminder_id: reminderId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('22023');
  });
});

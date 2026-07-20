import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the reminder-adjustment side effects added to cancel_appointment /
// reschedule_appointment / mark_appointment_no_show in 0012_reminder_lifecycle.sql
// (NEX-100). Requires the same env vars as publish-business.test.ts; skips cleanly
// when unset.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

function bookingTokenHash(seed: string) {
  return seed.padEnd(64, '0').slice(0, 64);
}

describe.runIf(canRun)('reminder lifecycle on reschedule/cancel/no_show (NEX-100)', () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;

  const tenantId = randomUUID();
  const email = `nex100-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  let userId: string;
  const slug = `nex100-${tenantId.slice(0, 8)}`;
  let clientId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    userA = createClient(url!, publishableKey!);

    await admin.from('tenants').insert({ id: tenantId, slug, name: 'Tenant', status: 'active' });
    await admin.from('business_settings').insert({ tenant_id: tenantId, buffer_minutes: 15 });

    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    await admin
      .from('profiles')
      .insert({ user_id: userId, tenant_id: tenantId, role: 'owner', display_name: 'Owner' });

    const signIn = await userA.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    const { data: client } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Client', phone_e164: '+351910000030' })
      .select('id')
      .single();
    clientId = client!.id;
  });

  afterAll(async () => {
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
  });

  async function seedAppointmentWithReminder(startAt: Date) {
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const id = randomUUID();
    await admin.from('appointments').insert({
      id,
      tenant_id: tenantId,
      client_id: clientId,
      source: 'admin',
      status: 'confirmed',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      blocked_until: new Date(endAt.getTime() + 15 * 60_000).toISOString(),
      expected_total_cents: 2500,
      booking_token_hash: bookingTokenHash(id),
    });
    await admin.from('reminders').insert({
      tenant_id: tenantId,
      appointment_id: id,
      due_at: new Date(startAt.getTime() - 24 * 60 * 60_000).toISOString(),
    });
    return id;
  }

  it('shifts a pending reminder due_at when the appointment is rescheduled', async () => {
    const appointmentId = await seedAppointmentWithReminder(
      new Date(Date.now() + 48 * 60 * 60_000),
    );
    const newStart = new Date(Date.now() + 96 * 60 * 60_000);

    const { error } = await userA.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_start_at: newStart.toISOString(),
    });
    expect(error).toBeNull();

    const reminder = await admin
      .from('reminders')
      .select('due_at, status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(reminder.data?.status).toBe('pending');
    expect(new Date(reminder.data!.due_at).getTime()).toBe(newStart.getTime() - 24 * 60 * 60_000);
  });

  it('does not touch a reminder already marked_sent when rescheduling', async () => {
    const appointmentId = await seedAppointmentWithReminder(
      new Date(Date.now() + 50 * 60 * 60_000),
    );
    await admin
      .from('reminders')
      .update({ status: 'marked_sent', marked_sent_at: new Date().toISOString() })
      .eq('appointment_id', appointmentId);

    const originalReminder = await admin
      .from('reminders')
      .select('due_at')
      .eq('appointment_id', appointmentId)
      .single();

    const { error } = await userA.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_start_at: new Date(Date.now() + 98 * 60 * 60_000).toISOString(),
    });
    expect(error).toBeNull();

    const reminder = await admin
      .from('reminders')
      .select('due_at, status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(reminder.data?.status).toBe('marked_sent');
    expect(reminder.data?.due_at).toBe(originalReminder.data?.due_at);
  });

  it('marks a pending reminder as skipped when the appointment is cancelled', async () => {
    const appointmentId = await seedAppointmentWithReminder(
      new Date(Date.now() + 52 * 60 * 60_000),
    );

    const { error } = await userA.rpc('cancel_appointment', { p_appointment_id: appointmentId });
    expect(error).toBeNull();

    const reminder = await admin
      .from('reminders')
      .select('status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(reminder.data?.status).toBe('skipped');
  });

  it('marks a pending reminder as skipped when the appointment is marked no_show', async () => {
    const appointmentId = await seedAppointmentWithReminder(
      new Date(Date.now() - 24 * 60 * 60_000),
    );

    const { error } = await userA.rpc('mark_appointment_no_show', {
      p_appointment_id: appointmentId,
    });
    expect(error).toBeNull();

    const reminder = await admin
      .from('reminders')
      .select('status')
      .eq('appointment_id', appointmentId)
      .single();
    expect(reminder.data?.status).toBe('skipped');
  });
});

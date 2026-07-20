-- NEX-084: cancel and reschedule, callable only by the owner's own authenticated
-- session. Both derive tenant_id from current_tenant_id() (the caller's session),
-- never from a parameter — an owner can only ever act on their own tenant's
-- appointments, mirroring publish_business (0005_publish_business.sql). Both write an
-- audit_logs row: "Ações internas com confirmação e auditoria" is this task's own
-- acceptance criterion, and audit_logs is append-only (0004_audit_logs_immutable.sql),
-- so this is a durable record, not just an application-level log line.
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment record;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status into v_appointment
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'appointment % not found for tenant', p_appointment_id using errcode = '22023';
  end if;
  if v_appointment.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'appointment % cannot be cancelled from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  update public.appointments
  set status = 'cancelled', cancelled_at = now()
  where id = p_appointment_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.cancelled', 'appointment', p_appointment_id, '{}'::jsonb);
end;
$$;

-- Rescheduling keeps every other fact about the appointment (client, items, price)
-- untouched and only moves start_at/end_at/blocked_until — the buffer is re-derived
-- from the tenant's current business_settings.buffer_minutes rather than assumed
-- unchanged, since the owner may have edited that setting since the original booking.
-- appointments_no_overlap (0001_initial.sql) still fires on the UPDATE below inside
-- this same transaction, so a conflicting new time rolls the whole call back — the
-- caller sees the same 23P01 the public booking flow already knows how to surface.
create or replace function public.reschedule_appointment(p_appointment_id uuid, p_new_start_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment record;
  v_duration_minutes integer;
  v_buffer_minutes integer;
  v_new_end_at timestamptz;
  v_new_blocked_until timestamptz;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status, start_at, end_at into v_appointment
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'appointment % not found for tenant', p_appointment_id using errcode = '22023';
  end if;
  if v_appointment.status not in ('confirmed', 'presence_confirmed') then
    raise exception 'appointment % cannot be rescheduled from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  v_duration_minutes := extract(epoch from (v_appointment.end_at - v_appointment.start_at)) / 60;

  select buffer_minutes into v_buffer_minutes
  from public.business_settings
  where tenant_id = v_tenant_id;

  v_new_end_at := p_new_start_at + make_interval(mins => v_duration_minutes);
  v_new_blocked_until := v_new_end_at + make_interval(mins => coalesce(v_buffer_minutes, 0));

  update public.appointments
  set start_at = p_new_start_at, end_at = v_new_end_at, blocked_until = v_new_blocked_until
  where id = p_appointment_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'appointment.rescheduled', 'appointment', p_appointment_id,
    jsonb_build_object('previous_start_at', v_appointment.start_at, 'new_start_at', p_new_start_at)
  );
end;
$$;

-- Both are meant to be called by the owner's own authenticated session — never by
-- anon, and never as a generic admin bypass (unlike provision_tenant_owner, which is
-- service_role-only). New functions in `public` are reachable by anon/authenticated by
-- default on this project (ADR-008) — revoking from PUBLIC alone does not undo that,
-- so both are revoked explicitly before re-granting only to authenticated.
revoke all on function public.cancel_appointment(uuid) from public;
revoke all on function public.cancel_appointment(uuid) from anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

revoke all on function public.reschedule_appointment(uuid, timestamptz) from public;
revoke all on function public.reschedule_appointment(uuid, timestamptz) from anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;

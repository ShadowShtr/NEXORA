-- NEX-100: "Reminder criado no booking e ajustado ao reagendar"
-- (docs/01_PRODUCT_REQUIREMENTS.md §8: "Lembrete devido 24 horas antes"). Creation on
-- booking already existed (create_public_booking/create_manual_booking,
-- 0007/0009 insert due_at = start_at - 24h) — the gap this migration closes is that
-- reschedule_appointment (0008_cancel_reschedule_appointment.sql) moved start_at
-- without ever touching the paired reminder's due_at, and cancel_appointment left a
-- cancelled appointment's reminder sitting as 'pending' forever (it would show up in
-- NEX-101's pending list for a booking that no longer exists in an active state).
--
-- Only reminders still 'pending' are touched — one already 'opened' or 'marked_sent'
-- (the dona already acted on it) is left alone rather than silently reset, since
-- re-litigating an action she already took isn't this task's job.
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

  update public.reminders
  set due_at = p_new_start_at - interval '24 hours'
  where appointment_id = p_appointment_id and status = 'pending';

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'appointment.rescheduled', 'appointment', p_appointment_id,
    jsonb_build_object('previous_start_at', v_appointment.start_at, 'new_start_at', p_new_start_at)
  );
end;
$$;

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

  update public.reminders
  set status = 'skipped'
  where appointment_id = p_appointment_id and status = 'pending';

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.cancelled', 'appointment', p_appointment_id, '{}'::jsonb);
end;
$$;

-- Same reasoning as cancel_appointment above: a no-show means there is nothing left to
-- remind anyone about. mark_appointment_no_show was introduced in 0011_no_show_policy.sql.
create or replace function public.mark_appointment_no_show(p_appointment_id uuid)
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
  if v_appointment.status not in ('confirmed', 'presence_confirmed') then
    raise exception 'appointment % cannot be marked no_show from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  update public.appointments
  set status = 'no_show'
  where id = p_appointment_id;

  update public.reminders
  set status = 'skipped'
  where appointment_id = p_appointment_id and status = 'pending';

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.no_show_marked', 'appointment', p_appointment_id, '{}'::jsonb);
end;
$$;

-- create or replace preserves the existing grants (revoke/grant only run once at
-- creation in 0008/0011), but restated here defensively in case this migration is ever
-- applied to a database where those grants were somehow lost.
revoke all on function public.cancel_appointment(uuid) from public;
revoke all on function public.cancel_appointment(uuid) from anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

revoke all on function public.reschedule_appointment(uuid, timestamptz) from public;
revoke all on function public.reschedule_appointment(uuid, timestamptz) from anon;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;

revoke all on function public.mark_appointment_no_show(uuid) from public;
revoke all on function public.mark_appointment_no_show(uuid) from anon;
grant execute on function public.mark_appointment_no_show(uuid) to authenticated;

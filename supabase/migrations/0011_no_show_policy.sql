-- NEX-095: "Política configurável de faltas" — the owner sets a threshold
-- (no_show_limit faltas within no_show_window_days); the app surfaces a visual warning
-- on the client's fiche/manual booking form when a client's no-show count within that
-- window reaches or exceeds the limit. This migration only adds the setting columns and
-- the missing "registar" primitive (mark_appointment_no_show) — the counting itself is
-- a plain SELECT the app already knows how to do (src/app/(dashboard)/dashboard/clientes/[id]/page.tsx
-- computes noShowCount today, just without a window; NEX-095 adds the window filter in
-- application code, no new RPC needed for a read). No automatic blocking is implemented
-- per product decision: this is alert-only, the owner decides case by case.
alter table public.business_settings
  add column no_show_limit integer check (no_show_limit is null or no_show_limit in (2, 3, 4, 5)),
  add column no_show_window_days integer not null default 90
    check (no_show_window_days in (30, 60, 90, 180));

-- appointment_status already has 'no_show' (0001_initial.sql) but nothing could ever
-- set it — cancel_appointment/reschedule_appointment (0008) only ever reach 'cancelled'.
-- Mirrors cancel_appointment exactly: security definer, tenant_id from the caller's own
-- session, 'for update' row lock, only reachable from the two active statuses, and an
-- audit_logs row (append-only, 0004_audit_logs_immutable.sql).
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

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.no_show_marked', 'appointment', p_appointment_id, '{}'::jsonb);
end;
$$;

-- New functions in `public` are reachable by anon/authenticated by default on this
-- project (ADR-008) — revoking from PUBLIC alone does not undo that, so both are
-- revoked explicitly before re-granting only to authenticated, same as
-- cancel_appointment/reschedule_appointment (0008).
revoke all on function public.mark_appointment_no_show(uuid) from public;
revoke all on function public.mark_appointment_no_show(uuid) from anon;
grant execute on function public.mark_appointment_no_show(uuid) to authenticated;

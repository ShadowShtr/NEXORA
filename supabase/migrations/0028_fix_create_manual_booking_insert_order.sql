-- Fixes the exact same class of pre-existing bug 0022_fix_create_public_booking_insert_order.sql
-- fixed for create_public_booking, in create_manual_booking (0009_create_manual_booking.sql,
-- never touched since): appointment_items rows were inserted *before* the appointments
-- row they reference (inline inside the package/service selection loops), but
-- appointments — which needs those totals for expected_total_cents/end_at/blocked_until,
-- all NOT NULL — was only inserted afterward. appointment_items_tenant_appointment_fkey
-- (0002_harden_tenant_fk_integrity.sql) is not DEFERRABLE, so this failed immediately on
-- every manual booking that included a service or package, i.e. every valid call (the
-- function itself requires v_total_minutes > 0): "insert or update on table
-- appointment_items violates foreign key constraint ... is not present in table
-- appointments" (23503). Caught via the integration suite once earlier CI blockers
-- (digest()/pgcrypto, audit_logs cleanup) were cleared out of the way.
--
-- Same fix shape as 0022: phase 1 validates the selection and computes
-- v_total_cents/v_total_minutes with read-only queries, appointments is inserted with
-- those totals already known, then phase 2 (appointments now exists) performs the
-- appointment_items inserts — identical in shape to the original inline inserts. No
-- other behavior changes: same validation, same errcodes, same snapshot-priced item
-- semantics.
create or replace function public.create_manual_booking(
  p_client_id uuid,
  p_client_name text,
  p_client_phone_e164 text,
  p_client_email text,
  p_selected_service_ids uuid[],
  p_selected_package_id uuid,
  p_start_at timestamptz,
  p_client_observation text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid;
  v_client_id uuid;
  v_appointment_id uuid;
  v_total_cents bigint := 0;
  v_total_minutes integer := 0;
  v_buffer_minutes integer;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_package_service_id uuid;
  v_booking_token_hash text;
  v_package record;
  v_service record;
  v_covered uuid[];
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select buffer_minutes into v_buffer_minutes
  from public.business_settings
  where tenant_id = v_tenant_id;

  if p_client_id is not null then
    select id into v_client_id
    from public.clients
    where id = p_client_id and tenant_id = v_tenant_id;
    if not found then
      raise exception 'client % not found for tenant', p_client_id using errcode = '22023';
    end if;
  else
    if p_client_name is null or p_client_phone_e164 is null then
      raise exception 'client name and phone are required when p_client_id is not given'
        using errcode = '22004';
    end if;
    insert into public.clients (tenant_id, name, phone_e164, email)
    values (v_tenant_id, p_client_name, p_client_phone_e164, nullif(p_client_email, ''))
    on conflict (tenant_id, phone_e164)
    do update set name = excluded.name, email = coalesce(excluded.email, public.clients.email)
    returning id into v_client_id;
  end if;

  v_appointment_id := gen_random_uuid();

  -- Phase 1: validate the selection and total it up — read-only, no appointment_items
  -- writes yet (the appointments row they'd reference doesn't exist until below).
  if p_selected_package_id is not null then
    select id, name, price_cents into v_package
    from public.packages
    where id = p_selected_package_id and tenant_id = v_tenant_id and is_active = true;
    if not found then
      raise exception 'package % not found for tenant', p_selected_package_id using errcode = '22023';
    end if;
    v_total_cents := v_total_cents + v_package.price_cents;

    for v_package_service_id in
      select ps.service_id from public.package_services ps where ps.package_id = v_package.id
    loop
      v_total_minutes := v_total_minutes
        + coalesce((select s.duration_minutes from public.services s where s.id = v_package_service_id), 0);
    end loop;
  end if;

  select coalesce(array_agg(ps.service_id), array[]::uuid[]) into v_covered
  from public.package_services ps
  where ps.package_id = p_selected_package_id;

  if p_selected_service_ids is not null then
    for v_service in
      select s.id, s.name, s.price_cents, s.duration_minutes
      from public.services s
      where s.id = any(p_selected_service_ids) and s.tenant_id = v_tenant_id and s.is_active = true
    loop
      if v_service.id = any(v_covered) then
        continue;
      end if;
      v_total_cents := v_total_cents + v_service.price_cents;
      v_total_minutes := v_total_minutes + v_service.duration_minutes;
    end loop;
  end if;

  if v_total_minutes <= 0 then
    raise exception 'booking must include at least one service or package' using errcode = '22023';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_total_minutes);
  v_blocked_until := v_end_at + make_interval(mins => coalesce(v_buffer_minutes, 0));

  v_booking_token_hash := encode(digest(v_appointment_id::text || v_tenant_id::text || clock_timestamp()::text, 'sha256'), 'hex');

  insert into public.appointments
    (id, tenant_id, client_id, source, status, start_at, end_at, blocked_until,
     expected_total_cents, booking_token_hash, client_observation)
  values
    (v_appointment_id, v_tenant_id, v_client_id, 'admin', 'confirmed', p_start_at, v_end_at, v_blocked_until,
     v_total_cents, v_booking_token_hash, nullif(p_client_observation, ''));

  -- Phase 2: the appointments row exists now — safe to write its line items.
  if p_selected_package_id is not null then
    insert into public.appointment_items
      (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
    values (v_tenant_id, v_appointment_id, 'package', v_package.id, v_package.name, v_package.price_cents, 0, 1);
  end if;

  if p_selected_service_ids is not null then
    for v_service in
      select s.id, s.name, s.price_cents, s.duration_minutes
      from public.services s
      where s.id = any(p_selected_service_ids) and s.tenant_id = v_tenant_id and s.is_active = true
    loop
      if v_service.id = any(v_covered) then
        continue;
      end if;
      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (v_tenant_id, v_appointment_id, 'service', v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes, 1);
    end loop;
  end if;

  insert into public.reminders (tenant_id, appointment_id, due_at)
  values (v_tenant_id, v_appointment_id, p_start_at - interval '24 hours');

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.created', 'appointment', v_appointment_id,
          jsonb_build_object('source', 'admin', 'total_cents', v_total_cents));

  return v_appointment_id;
end;
$$;

revoke all on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from public;
revoke all on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from anon;
grant execute on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) to authenticated;

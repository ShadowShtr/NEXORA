-- NEX-122: "Criar série atomicamente" — "Nenhuma série parcial sem confirmação
-- explícita." create_recurring_series creates one recurring_series row (already defined
-- since 0001_initial.sql, unused until now) plus one appointment per occurrence, all
-- inside this single plpgsql function call — Postgres runs the whole function body as
-- one transaction, so an unhandled exception on any occurrence (most commonly
-- appointments_no_overlap firing 23P01, the same exclusion constraint every other
-- booking path already relies on) aborts the entire call: the recurring_series row and
-- every appointment/appointment_items/reminders row already inserted earlier in this
-- same loop roll back too. No explicit rollback logic needed — this is Postgres'
-- ordinary transactional behavior, just relied on deliberately here.
--
-- p_occurrence_starts_at is trusted as already-resolved: the caller (NEX-120's
-- generateRecurrenceOccurrences + NEX-121's checkRecurrenceConflicts, both client-side)
-- already generated the candidate dates and let the owner replace/drop conflicting ones,
-- so this function never re-derives dates from p_frequency/p_interval_value — those two
-- are stored on recurring_series purely as descriptive metadata for later display/edit
-- (NEX-123), not fed back into date math here. appointments_no_overlap still catches any
-- overlap the owner missed (including occurrences overlapping each other), same as a
-- single create_manual_booking call.
--
-- Client resolution, service/package pricing/duration snapshot, and the
-- appointments/appointment_items/reminders shape per occurrence mirror
-- create_manual_booking (0028_fix_create_manual_booking_insert_order.sql) exactly — same
-- phase-1-validate/phase-2-write ordering per occurrence, applied in a loop instead of
-- once. A single audit_logs row is written at the series level (not one per appointment)
-- to avoid up to 52 near-identical rows for one owner action.
create or replace function public.create_recurring_series(
  p_client_id uuid,
  p_client_name text,
  p_client_phone_e164 text,
  p_client_email text,
  p_selected_service_ids uuid[],
  p_selected_package_id uuid,
  p_frequency text,
  p_interval_value integer,
  p_occurrence_starts_at timestamptz[],
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
  v_series_id uuid;
  v_occurrence_count integer;
  v_total_cents bigint := 0;
  v_total_minutes integer := 0;
  v_buffer_minutes integer;
  v_package_service_id uuid;
  v_package record;
  v_service record;
  v_covered uuid[];
  v_start_at timestamptz;
  v_appointment_id uuid;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_booking_token_hash text;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  v_occurrence_count := coalesce(array_length(p_occurrence_starts_at, 1), 0);
  if v_occurrence_count < 2 or v_occurrence_count > 52 then
    raise exception 'occurrence count must be between 2 and 52' using errcode = '22023';
  end if;
  if p_frequency not in ('weekly', 'biweekly', 'three_weeks', 'monthly', 'custom') then
    raise exception 'invalid frequency %', p_frequency using errcode = '22023';
  end if;
  if p_interval_value is null or p_interval_value < 1 or p_interval_value > 52 then
    raise exception 'interval_value must be between 1 and 52' using errcode = '22023';
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

  -- Phase 1: validate the selection and total it up once — the same price/duration
  -- snapshot applies to every occurrence in the series.
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

  insert into public.recurring_series (tenant_id, client_id, frequency, interval_value, occurrence_count)
  values (v_tenant_id, v_client_id, p_frequency, p_interval_value, v_occurrence_count)
  returning id into v_series_id;

  foreach v_start_at in array p_occurrence_starts_at
  loop
    v_appointment_id := gen_random_uuid();
    v_end_at := v_start_at + make_interval(mins => v_total_minutes);
    v_blocked_until := v_end_at + make_interval(mins => coalesce(v_buffer_minutes, 0));
    v_booking_token_hash :=
      encode(digest(v_appointment_id::text || v_tenant_id::text || clock_timestamp()::text, 'sha256'), 'hex');

    insert into public.appointments
      (id, tenant_id, client_id, recurring_series_id, source, status, start_at, end_at, blocked_until,
       expected_total_cents, booking_token_hash, client_observation)
    values
      (v_appointment_id, v_tenant_id, v_client_id, v_series_id, 'admin', 'confirmed', v_start_at, v_end_at,
       v_blocked_until, v_total_cents, v_booking_token_hash, nullif(p_client_observation, ''));

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
    values (v_tenant_id, v_appointment_id, v_start_at - interval '24 hours');
  end loop;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'recurring_series.created', 'recurring_series', v_series_id,
    jsonb_build_object(
      'frequency', p_frequency, 'interval_value', p_interval_value,
      'occurrence_count', v_occurrence_count, 'total_cents', v_total_cents
    )
  );

  return v_series_id;
end;
$$;

revoke all on function public.create_recurring_series(
  uuid, text, text, text, uuid[], uuid, text, integer, timestamptz[], text
) from public;
revoke all on function public.create_recurring_series(
  uuid, text, text, text, uuid[], uuid, text, integer, timestamptz[], text
) from anon;
grant execute on function public.create_recurring_series(
  uuid, text, text, text, uuid[], uuid, text, integer, timestamptz[], text
) to authenticated;

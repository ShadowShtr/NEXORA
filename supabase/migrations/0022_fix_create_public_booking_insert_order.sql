-- Fixes a real, pre-existing bug in create_public_booking (0007_create_public_booking.sql,
-- carried through 0018/0021 unchanged): appointment_items rows were inserted *before*
-- the appointments row they reference, because totals/duration were computed by
-- inserting each item inline inside the selection loops, and appointments (which needs
-- those totals for expected_total_cents/end_at/blocked_until, all NOT NULL) was only
-- inserted afterward. appointment_items_tenant_appointment_fkey
-- (0002_harden_tenant_fk_integrity.sql) is not DEFERRABLE, so this failed immediately on
-- every booking that included a service or package: "insert or update on table
-- appointment_items violates foreign key constraint ... is not present in table
-- appointments" (23503). Confirmed live.
--
-- Fix: split into two phases. Phase 1 validates the selection and computes
-- v_total_cents/v_total_minutes with read-only queries (no writes) — same source
-- queries as before, just not inserting yet. The appointments row is then inserted with
-- those totals already known. Phase 2 (after appointments exists) performs the actual
-- appointment_items inserts, identical in shape to the original inline inserts. No
-- other behavior changes: same validation, same errcodes, same snapshot-priced
-- item semantics (CLAUDE.md: "appointment item é snapshot e não muda quando o serviço é
-- editado").
create or replace function public.create_public_booking(
  p_tenant_id uuid,
  p_client_name text,
  p_client_phone_e164 text,
  p_client_email text,
  p_selected_service_ids uuid[],
  p_selected_package_id uuid,
  p_start_at timestamptz,
  p_idempotency_key text
)
returns table (appointment_id uuid, booking_token text, lookup_code text, is_replay boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_appointment_id uuid;
  v_booking_token text;
  v_booking_token_hash text;
  v_lookup_code text;
  v_lookup_code_hash text;
  v_lookup_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_lookup_attempt integer;
  v_total_cents bigint := 0;
  v_total_minutes integer := 0;
  v_buffer_minutes integer;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_package_service_id uuid;
  v_idempotency_key_hash text;
  v_payload_hash text;
  v_existing record;
  v_package record;
  v_service record;
  v_covered uuid[];
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required' using errcode = '22004';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) <> 64 then
    raise exception 'p_idempotency_key must be a 64-character hex string' using errcode = '22004';
  end if;

  v_idempotency_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_payload_hash := encode(
    digest(
      p_client_name || '|' || p_client_phone_e164 || '|' || coalesce(p_client_email, '') || '|'
      || coalesce((select string_agg(x::text, ',' order by x::text) from unnest(p_selected_service_ids) x), '')
      || '|' || coalesce(p_selected_package_id::text, '') || '|' || p_start_at::text,
      'sha256'
    ),
    'hex'
  );

  select a.id, a.idempotency_payload_hash into v_existing
  from public.appointments a
  where a.tenant_id = p_tenant_id and a.idempotency_key_hash = v_idempotency_key_hash;

  if found then
    if v_existing.idempotency_payload_hash <> v_payload_hash then
      raise exception 'idempotency key already used with a different booking payload'
        using errcode = '23505', hint = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.id, null::text, null::text, true;
    return;
  end if;

  select bs.buffer_minutes into v_buffer_minutes
  from public.business_settings bs
  join public.tenants t on t.id = bs.tenant_id
  where bs.tenant_id = p_tenant_id and t.status = 'active' and bs.published_at is not null;
  if v_buffer_minutes is null then
    raise exception 'tenant % is not published', p_tenant_id using errcode = '42501';
  end if;

  insert into public.clients (tenant_id, name, phone_e164, email)
  values (p_tenant_id, p_client_name, p_client_phone_e164, nullif(p_client_email, ''))
  on conflict (tenant_id, phone_e164)
  do update set name = excluded.name, email = coalesce(excluded.email, public.clients.email)
  returning id into v_client_id;

  v_appointment_id := gen_random_uuid();

  -- Phase 1: validate the selection and total it up — read-only, no appointment_items
  -- writes yet (the appointments row they'd reference doesn't exist until below).
  if p_selected_package_id is not null then
    select id, name, price_cents into v_package
    from public.packages
    where id = p_selected_package_id and tenant_id = p_tenant_id and is_active = true;
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
      where s.id = any(p_selected_service_ids) and s.tenant_id = p_tenant_id and s.is_active = true
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
  v_blocked_until := v_end_at + make_interval(mins => v_buffer_minutes);

  v_booking_token := encode(gen_random_bytes(32), 'hex');
  v_booking_token_hash := encode(digest(v_booking_token, 'sha256'), 'hex');

  v_lookup_attempt := 0;
  loop
    v_lookup_code := '';
    for i in 1..8 loop
      v_lookup_code := v_lookup_code
        || substr(v_lookup_alphabet, 1 + floor(random() * length(v_lookup_alphabet))::int, 1);
    end loop;
    v_lookup_code_hash := encode(digest(v_lookup_code, 'sha256'), 'hex');
    exit when not exists (
      select 1 from public.appointments where booking_lookup_code_hash = v_lookup_code_hash
    );
    v_lookup_attempt := v_lookup_attempt + 1;
    if v_lookup_attempt > 20 then
      raise exception 'could not generate a unique lookup code' using errcode = '40001';
    end if;
  end loop;

  insert into public.appointments
    (id, tenant_id, client_id, source, status, start_at, end_at, blocked_until,
     expected_total_cents, booking_token_hash, booking_lookup_code_hash,
     idempotency_key_hash, idempotency_payload_hash)
  values
    (v_appointment_id, p_tenant_id, v_client_id, 'public', 'confirmed', p_start_at, v_end_at, v_blocked_until,
     v_total_cents, v_booking_token_hash, v_lookup_code_hash, v_idempotency_key_hash, v_payload_hash);

  -- Phase 2: the appointments row exists now — safe to write its line items.
  if p_selected_package_id is not null then
    insert into public.appointment_items
      (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
    values (p_tenant_id, v_appointment_id, 'package', v_package.id, v_package.name, v_package.price_cents, 0, 1);
  end if;

  if p_selected_service_ids is not null then
    for v_service in
      select s.id, s.name, s.price_cents, s.duration_minutes
      from public.services s
      where s.id = any(p_selected_service_ids) and s.tenant_id = p_tenant_id and s.is_active = true
    loop
      if v_service.id = any(v_covered) then
        continue;
      end if;
      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (p_tenant_id, v_appointment_id, 'service', v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes, 1);
    end loop;
  end if;

  insert into public.reminders (tenant_id, appointment_id, due_at)
  values (p_tenant_id, v_appointment_id, p_start_at - interval '24 hours');

  insert into public.audit_logs (tenant_id, action, resource_type, resource_id, metadata)
  values (p_tenant_id, 'appointment.created', 'appointment', v_appointment_id,
          jsonb_build_object('source', 'public', 'total_cents', v_total_cents));

  return query select v_appointment_id, v_booking_token, v_lookup_code, false;
end;
$$;

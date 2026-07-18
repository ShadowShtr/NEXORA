-- NEX-085: manual booking creation by the owner's own authenticated session, mirroring
-- create_public_booking (NEX-064, 0007_create_public_booking.sql) but for a different
-- caller: the owner already has a session (tenant_id comes from current_tenant_id(),
-- never a parameter — same authorization boundary as cancel_appointment/
-- reschedule_appointment, NEX-084), so this skips the idempotency-key/token machinery
-- that exists only to protect an *anonymous* caller retrying over an unreliable
-- connection. Price/duration snapshots are still always re-read from the live catalog,
-- never trusted from the caller, exactly like the public path — the owner's own client
-- could in principle send a stale/tampered total, so the same server-side authority
-- applies regardless of who's calling.
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
set search_path = public
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
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select buffer_minutes into v_buffer_minutes
  from public.business_settings
  where tenant_id = v_tenant_id;

  -- Either an existing client (p_client_id, verified to belong to this tenant) or
  -- enough to create a new one — mirrors NEX-092's "cliente existente" acceptance
  -- criterion: the owner can pick from her own client list instead of re-typing
  -- contact details for someone already in clients.
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

  -- Snapshot each selected package's own services, then any individually-selected
  -- service not already covered by that package — same shape as create_public_booking.
  if p_selected_package_id is not null then
    declare
      v_package record;
    begin
      select id, name, price_cents into v_package
      from public.packages
      where id = p_selected_package_id and tenant_id = v_tenant_id and is_active = true;
      if not found then
        raise exception 'package % not found for tenant', p_selected_package_id using errcode = '22023';
      end if;

      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (v_tenant_id, v_appointment_id, 'package', v_package.id, v_package.name, v_package.price_cents, 0, 1);
      v_total_cents := v_total_cents + v_package.price_cents;

      for v_package_service_id in
        select ps.service_id from public.package_services ps where ps.package_id = v_package.id
      loop
        v_total_minutes := v_total_minutes
          + coalesce((select s.duration_minutes from public.services s where s.id = v_package_service_id), 0);
      end loop;
    end;
  end if;

  if p_selected_service_ids is not null then
    declare
      v_service record;
      v_covered uuid[];
    begin
      select coalesce(array_agg(ps.service_id), array[]::uuid[]) into v_covered
      from public.package_services ps
      where ps.package_id = p_selected_package_id;

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
        v_total_cents := v_total_cents + v_service.price_cents;
        v_total_minutes := v_total_minutes + v_service.duration_minutes;
      end loop;
    end;
  end if;

  if v_total_minutes <= 0 then
    raise exception 'booking must include at least one service or package' using errcode = '22023';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_total_minutes);
  v_blocked_until := v_end_at + make_interval(mins => coalesce(v_buffer_minutes, 0));

  -- A manual booking still gets a public link (booking_token_hash is NOT NULL,
  -- 0001_initial.sql) so "ver marcação"/ICS work identically regardless of how the
  -- appointment was created — but nothing here ever returns the plaintext token, since
  -- there is no client-facing confirmation screen to hand it to for this source.
  v_booking_token_hash := encode(digest(v_appointment_id::text || v_tenant_id::text || clock_timestamp()::text, 'sha256'), 'hex');

  insert into public.appointments
    (id, tenant_id, client_id, source, status, start_at, end_at, blocked_until,
     expected_total_cents, booking_token_hash, client_observation)
  values
    (v_appointment_id, v_tenant_id, v_client_id, 'admin', 'confirmed', p_start_at, v_end_at, v_blocked_until,
     v_total_cents, v_booking_token_hash, nullif(p_client_observation, ''));

  insert into public.reminders (tenant_id, appointment_id, due_at)
  values (v_tenant_id, v_appointment_id, p_start_at - interval '24 hours');

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'appointment.created', 'appointment', v_appointment_id,
          jsonb_build_object('source', 'admin', 'total_cents', v_total_cents));

  return v_appointment_id;
end;
$$;

-- Owner-only: the caller must already be authenticated with a tenant (unlike
-- create_public_booking, which anon calls). Revoked from PUBLIC/anon explicitly per
-- ADR-008, granted only to authenticated.
revoke all on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from public;
revoke all on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from anon;
grant execute on function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) to authenticated;

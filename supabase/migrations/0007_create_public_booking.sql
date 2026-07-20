-- NEX-064: atomic, idempotent public booking creation.
--
-- The anonymous booking page (NEX-050/054) has no session to scope a request by, and
-- none of the tables involved (clients, appointments, appointment_items, reminders)
-- carry an `anon` write policy — writing them one PostgREST call at a time from the
-- server would also leave a window between the availability check (NEX-062) and the
-- INSERT for two visitors to race for the same slot. A single security definer
-- function makes the whole operation atomic: either everything commits — client
-- upsert, price/duration snapshots, the appointment itself, and its 24h reminder — or
-- nothing does. Double-booking itself is still enforced by appointments_no_overlap
-- (NEX-063), which fires on the INSERT below inside this same transaction, so a 23P01
-- there rolls back the client upsert and every item with it — this function is what
-- makes the *rest* of the booking fail alongside it instead of partially applying.
--
-- Price and duration are never trusted from the caller: every appointment_items line
-- is priced and timed by re-reading services/packages from the database inside this
-- function, mirroring CLAUDE.md's "autorize no servidor; a UI nunca é um controlo de
-- segurança" for money, not just for access control.
alter table public.appointments add column idempotency_key_hash text;
alter table public.appointments add column idempotency_payload_hash text;
alter table public.appointments add constraint appointments_idempotency_key_hash_check
  check (idempotency_key_hash is null or char_length(idempotency_key_hash) = 64);
create unique index appointments_tenant_idempotency_key_idx
  on public.appointments (tenant_id, idempotency_key_hash)
  where idempotency_key_hash is not null;

-- docs/06_API_CONTRACTS.md: "devolve token público uma única vez" — the plaintext
-- booking_token is never persisted (only booking_token_hash, 0001_initial.sql), so a
-- retry can never re-derive and return it. Idempotency here means a replay with the
-- same key + same payload is recognized as "already done" (is_replay = true,
-- booking_token = null, the caller already has it from the first response) rather than
-- creating a second appointment; the same key with a *different* payload is rejected
-- outright (IDEMPOTENCY_CONFLICT, docs/06_API_CONTRACTS.md) instead of silently booking
-- something the key wasn't meant to authorize.
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
returns table (appointment_id uuid, booking_token text, is_replay boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_appointment_id uuid;
  v_booking_token text;
  v_booking_token_hash text;
  v_total_cents bigint := 0;
  v_total_minutes integer := 0;
  v_buffer_minutes integer;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_package_service_id uuid;
  v_idempotency_key_hash text;
  v_payload_hash text;
  v_existing record;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required' using errcode = '22004';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) <> 64 then
    raise exception 'p_idempotency_key must be a 64-character hex string' using errcode = '22004';
  end if;

  v_idempotency_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  -- Payload fingerprint covers everything that would change what gets booked; array
  -- selections are sorted first so equivalent requests with items in a different order
  -- still hash identically.
  v_payload_hash := encode(
    digest(
      p_client_name || '|' || p_client_phone_e164 || '|' || coalesce(p_client_email, '') || '|'
      || coalesce((select string_agg(x::text, ',') from unnest(p_selected_service_ids) x order by x::text), '')
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
    return query select v_existing.id, null::text, true;
    return;
  end if;

  select bs.buffer_minutes into v_buffer_minutes
  from public.business_settings bs
  join public.tenants t on t.id = bs.tenant_id
  where bs.tenant_id = p_tenant_id and t.status = 'active' and bs.published_at is not null;
  if v_buffer_minutes is null then
    raise exception 'tenant % is not published', p_tenant_id using errcode = '42501';
  end if;

  -- Client upsert by (tenant_id, phone_e164) — the same visitor booking again is the
  -- same client, never a duplicate row (0001_initial.sql unique constraint).
  insert into public.clients (tenant_id, name, phone_e164, email)
  values (p_tenant_id, p_client_name, p_client_phone_e164, nullif(p_client_email, ''))
  on conflict (tenant_id, phone_e164)
  do update set name = excluded.name, email = coalesce(excluded.email, public.clients.email)
  returning id into v_client_id;

  v_appointment_id := gen_random_uuid();

  -- Snapshot each selected package's own services, then any individually-selected
  -- service not already covered by that package — mirrors cartLines() in
  -- src/app/b/[slug]/domain/booking-selection.ts (NEX-054), re-implemented here in SQL
  -- because totals must be derived from the live catalog, not trusted from the client.
  if p_selected_package_id is not null then
    declare
      v_package record;
    begin
      select id, name, price_cents into v_package
      from public.packages
      where id = p_selected_package_id and tenant_id = p_tenant_id and is_active = true;
      if not found then
        raise exception 'package % not found for tenant', p_selected_package_id using errcode = '22023';
      end if;

      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (p_tenant_id, v_appointment_id, 'package', v_package.id, v_package.name, v_package.price_cents, 0, 1);
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
        where s.id = any(p_selected_service_ids) and s.tenant_id = p_tenant_id and s.is_active = true
      loop
        if v_service.id = any(v_covered) then
          continue;
        end if;
        insert into public.appointment_items
          (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
        values (p_tenant_id, v_appointment_id, 'service', v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes, 1);
        v_total_cents := v_total_cents + v_service.price_cents;
        v_total_minutes := v_total_minutes + v_service.duration_minutes;
      end loop;
    end;
  end if;

  if v_total_minutes <= 0 then
    raise exception 'booking must include at least one service or package' using errcode = '22023';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_total_minutes);
  v_blocked_until := v_end_at + make_interval(mins => v_buffer_minutes);

  v_booking_token := encode(gen_random_bytes(32), 'hex');
  v_booking_token_hash := encode(digest(v_booking_token, 'sha256'), 'hex');

  insert into public.appointments
    (id, tenant_id, client_id, source, status, start_at, end_at, blocked_until,
     expected_total_cents, booking_token_hash, idempotency_key_hash, idempotency_payload_hash)
  values
    (v_appointment_id, p_tenant_id, v_client_id, 'public', 'confirmed', p_start_at, v_end_at, v_blocked_until,
     v_total_cents, v_booking_token_hash, v_idempotency_key_hash, v_payload_hash);

  insert into public.reminders (tenant_id, appointment_id, due_at)
  values (p_tenant_id, v_appointment_id, p_start_at - interval '24 hours');

  insert into public.audit_logs (tenant_id, action, resource_type, resource_id, metadata)
  values (p_tenant_id, 'appointment.created', 'appointment', v_appointment_id,
          jsonb_build_object('source', 'public', 'total_cents', v_total_cents));

  return query select v_appointment_id, v_booking_token, false;
end;
$$;

-- Public-facing: any anonymous visitor may call this to book, but it can only ever
-- write to the single tenant_id it's given, and only for a tenant that is published —
-- there is no broader privilege here than the public booking page itself already
-- implies. Still revoked from PUBLIC/anon/authenticated first and re-granted
-- explicitly to anon only, per ADR-008 (new functions are reachable by anon/
-- authenticated by default on this project; revoking from PUBLIC alone does not undo
-- that).
revoke all on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from public;
revoke all on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from authenticated;
grant execute on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) to anon;

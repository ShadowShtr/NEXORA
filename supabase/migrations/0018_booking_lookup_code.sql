-- "Consultar marcação por código" — an alternative to the 64-hex booking_token link for
-- a client who deleted the confirmation e-mail/SMS but remembers a short code. A 6-char
-- code alone (as first proposed) is brute-forceable even with rate limiting — 60
-- attempts/min (bookingLookup limiter, src/lib/rate-limit.ts) distributed across enough
-- IPs sweeps ~1e6 combinations in hours, exposing another client's name/phone/address to
-- an attacker with no other credential. 8 alphanumeric characters (this migration) from
-- a 32-symbol alphabet is ~1e12 combinations — the same security margin class as the
-- existing booking_token's own defense-in-depth reasoning, just short enough to
-- read/type by hand. Ambiguous characters (0/O, 1/I/L) are excluded from the alphabet
-- so a client transcribing it by hand from a screen or a read-aloud call can't confuse
-- them.
--
-- Same storage discipline as booking_token_hash (0001_initial.sql): only the SHA-256
-- hash is ever persisted, the plaintext code is returned once by create_public_booking
-- and never recoverable afterward — losing it means falling back to the original link,
-- exactly like losing the booking_token.
alter table public.appointments
  add column booking_lookup_code_hash text unique
    check (booking_lookup_code_hash is null or char_length(booking_lookup_code_hash) = 64);

-- Minimal diff over create_public_booking (0007_create_public_booking.sql): adds
-- v_lookup_code/v_lookup_code_hash generation (a short retry loop — the unique index
-- above means a collision must be retried, astronomically rare at 8 chars / 32 symbols
-- but the loop costs nothing to have) and threads lookup_code through both
-- `return query select` branches. Every other line — idempotency validation, the
-- payload hash covering name/phone/email/services/package/start_at, the
-- IDEMPOTENCY_CONFLICT branch, the tenant-published check — is unchanged from 0007.
--
-- Postgres refuses `create or replace function` when the return type itself changes
-- (adding a column to a `returns table (...)` is a type change, not just a body edit) —
-- the old 3-column signature must be dropped first.
drop function if exists public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text);

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

  insert into public.reminders (tenant_id, appointment_id, due_at)
  values (p_tenant_id, v_appointment_id, p_start_at - interval '24 hours');

  insert into public.audit_logs (tenant_id, action, resource_type, resource_id, metadata)
  values (p_tenant_id, 'appointment.created', 'appointment', v_appointment_id,
          jsonb_build_object('source', 'public', 'total_cents', v_total_cents));

  return query select v_appointment_id, v_booking_token, v_lookup_code, false;
end;
$$;

-- New lookup RPC: resolves a lookup code straight to the full booking detail, the same
-- shape resolveBookingByToken (src/lib/booking-token-lookup.ts) already returns for the
-- token-based path — the plaintext booking_token is never stored (same discipline as
-- everywhere else in this codebase), so there is no way to "redirect to
-- /marcacao/[token]" once only the code is known; /marcacao (the code-entry page)
-- renders this result directly instead of trying to re-derive a token. Uniform
-- empty-result-on-miss (unknown code, malformed input) mirrors resolveBookingByToken's
-- own uniform-404 behavior (docs/05_SECURITY_PRIVACY.md, T3) — never a different
-- response shape for "wrong length" vs "not found", so a caller can't use response
-- shape to distinguish "almost right" from "not even close" while brute-forcing.
create or replace function public.resolve_booking_lookup_code(p_code text)
returns table (
  appointment_id uuid,
  status public.appointment_status,
  start_at timestamptz,
  end_at timestamptz,
  total_cents bigint,
  tenant_name text,
  professional_name text,
  address_line text,
  postal_code text,
  locality text,
  maps_url text,
  timezone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_hash text;
begin
  if p_code is null or char_length(p_code) <> 8 then
    return;
  end if;

  v_code_hash := encode(digest(upper(p_code), 'sha256'), 'hex');

  return query
  select
    a.id,
    a.status,
    a.start_at,
    a.end_at,
    coalesce(a.final_total_cents, a.expected_total_cents),
    t.name,
    bs.professional_name,
    bs.address_line,
    bs.postal_code,
    bs.locality,
    bs.maps_url,
    bs.timezone
  from public.appointments a
  join public.tenants t on t.id = a.tenant_id
  left join public.business_settings bs on bs.tenant_id = a.tenant_id
  where a.booking_lookup_code_hash = v_code_hash;
end;
$$;

-- Same grant discipline as 0007: revoked from PUBLIC/anon/authenticated first and
-- re-granted explicitly, per ADR-008.
revoke all on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from public;
revoke all on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) from authenticated;
grant execute on function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text) to anon;

revoke all on function public.resolve_booking_lookup_code(text) from public;
revoke all on function public.resolve_booking_lookup_code(text) from authenticated;
grant execute on function public.resolve_booking_lookup_code(text) to anon;

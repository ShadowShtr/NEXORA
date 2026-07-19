-- NEX-111: "Tela Ver mais e extras" — "Serviço existente ou ajuste manual." Extras are
-- appended as appointment_items in the same transaction as the completion itself
-- (complete_appointment, 0015_complete_appointment.sql) rather than a separate RPC
-- call, for the same atomicity reason NEX-113 already established: a partial write
-- (completed appointment with a missing extra line) must be impossible.
--
-- p_extra_service_ids re-prices each service from the live catalog, exactly like
-- create_public_booking/create_manual_booking — even though this is an authenticated
-- owner action (where p_final_total_cents itself is already trusted from the caller,
-- 0015's own reasoning), a service's *price* still comes from a single source of truth
-- (the catalog) rather than being re-typed by the owner for every completion, so a
-- price change she makes in Serviços later is reflected the next time she adds that
-- same extra. p_manual_extras is free-form {description, unit_price_cents} pairs for
-- anything not in the catalog ("ajuste manual") — its amounts are trusted from the
-- caller (same reasoning as p_final_total_cents), but validated for shape (positive
-- price, non-empty description) so a malformed row can't silently insert as $0 or
-- blank text.
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_final_total_cents bigint,
  p_payment_status public.payment_status,
  p_payment_method public.payment_method,
  p_extra_service_ids uuid[] default null,
  p_manual_extras jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment record;
  v_service record;
  v_manual_extra jsonb;
  v_description text;
  v_unit_price_cents bigint;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  if p_final_total_cents < 0 then
    raise exception 'final total cannot be negative' using errcode = '22023';
  end if;
  if p_payment_status = 'refunded' then
    raise exception 'a completion cannot start as refunded' using errcode = '22023';
  end if;
  if (p_payment_status = 'pending') <> (p_payment_method is null) then
    raise exception 'payment method must be set if and only if status is not pending'
      using errcode = '22023';
  end if;

  select id, status, expected_total_cents into v_appointment
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'appointment % not found for tenant', p_appointment_id using errcode = '22023';
  end if;
  if v_appointment.status not in ('confirmed', 'presence_confirmed') then
    raise exception 'appointment % cannot be completed from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  update public.appointments
  set status = 'completed', completed_at = now(), final_total_cents = p_final_total_cents
  where id = p_appointment_id;

  if p_extra_service_ids is not null then
    for v_service in
      select s.id, s.name, s.price_cents, s.duration_minutes
      from public.services s
      where s.id = any(p_extra_service_ids) and s.tenant_id = v_tenant_id and s.is_active = true
    loop
      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (v_tenant_id, p_appointment_id, 'service', v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes, 1);
    end loop;
  end if;

  if p_manual_extras is not null then
    for v_manual_extra in select * from jsonb_array_elements(p_manual_extras)
    loop
      v_description := trim(v_manual_extra ->> 'description');
      v_unit_price_cents := (v_manual_extra ->> 'unitPriceCents')::bigint;

      if v_description is null or char_length(v_description) not between 1 and 200 then
        raise exception 'manual extra description must be 1-200 characters' using errcode = '22023';
      end if;
      if v_unit_price_cents is null or v_unit_price_cents < 0 then
        raise exception 'manual extra price cannot be negative' using errcode = '22023';
      end if;

      insert into public.appointment_items
        (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
      values (v_tenant_id, p_appointment_id, 'manual_extra', null, v_description, v_unit_price_cents, 0, 1);
    end loop;
  end if;

  insert into public.payments (tenant_id, appointment_id, method, status, amount_cents, paid_at)
  values (
    v_tenant_id, p_appointment_id, p_payment_method, p_payment_status, p_final_total_cents,
    case when p_payment_status = 'pending' then null else now() end
  );

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'appointment.completed', 'appointment', p_appointment_id,
    jsonb_build_object(
      'expected_total_cents', v_appointment.expected_total_cents,
      'final_total_cents', p_final_total_cents,
      'payment_status', p_payment_status
    )
  );
end;
$$;

-- The old 4-argument overload is superseded by the 6-argument one above (the two new
-- parameters have defaults, so every existing caller keeps working unmodified) — drop
-- it so PostgREST's RPC resolution never has two complete_appointment candidates for a
-- 4-argument call.
drop function if exists public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method);

revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb) from public;
revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb) from anon;
grant execute on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb) to authenticated;

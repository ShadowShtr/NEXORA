-- NEX-112: "Descontos fixos/percentuais" — "Motivo opcional, limites e total nunca
-- negativo." Stored as a negative-amount appointment_items row (source_type='discount',
-- unit_price_cents < 0) — unit_price_cents has no >= 0 check (unlike services.price_cents,
-- 0001_initial.sql), so summing every appointment_items row for an appointment yields
-- the actual charged total directly, discount included, without a separate discount
-- column anyone reading appointment_items could miss.
--
-- p_discount_type/p_discount_value/p_discount_reason are trusted from the caller (same
-- boundary as p_final_total_cents/p_manual_extras — an authenticated owner action on
-- her own tenant), but the computed discount amount is clamped so it can never exceed
-- p_final_total_cents ("total nunca negativo" — the discount reduces what was already
-- decided as the final total, it cannot itself drive the completion negative). Percent
-- is computed against p_final_total_cents (the value the owner is actually completing
-- for, extras included), not the original expected_total_cents.
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_final_total_cents bigint,
  p_payment_status public.payment_status,
  p_payment_method public.payment_method,
  p_extra_service_ids uuid[] default null,
  p_manual_extras jsonb default null,
  p_discount_type text default null,
  p_discount_value numeric default null,
  p_discount_reason text default null
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
  v_discount_cents bigint;
  v_discount_description text;
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
  if p_discount_type is not null and p_discount_type not in ('fixed', 'percent') then
    raise exception 'discount type must be fixed or percent' using errcode = '22023';
  end if;
  if p_discount_type is not null and (p_discount_value is null or p_discount_value <= 0) then
    raise exception 'discount value must be positive' using errcode = '22023';
  end if;
  if p_discount_type = 'percent' and p_discount_value > 100 then
    raise exception 'percent discount cannot exceed 100' using errcode = '22023';
  end if;
  if p_discount_reason is not null and char_length(p_discount_reason) > 200 then
    raise exception 'discount reason must be at most 200 characters' using errcode = '22023';
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

  if p_discount_type is not null then
    if p_discount_type = 'fixed' then
      v_discount_cents := round(p_discount_value);
      v_discount_description := 'Desconto';
    else
      v_discount_cents := round(p_final_total_cents * p_discount_value / 100.0);
      v_discount_description := format('Desconto (%s%%)', trim(to_char(p_discount_value, 'FM999999990.##')));
    end if;

    -- Clamp: the discount line can never make the sum of appointment_items imply less
    -- than $0 was charged, regardless of what value the owner typed.
    v_discount_cents := least(v_discount_cents, p_final_total_cents);
    if p_discount_reason is not null and trim(p_discount_reason) <> '' then
      v_discount_description := v_discount_description || ' — ' || trim(p_discount_reason);
    end if;

    insert into public.appointment_items
      (tenant_id, appointment_id, source_type, source_id, description, unit_price_cents, duration_minutes, quantity)
    values (v_tenant_id, p_appointment_id, 'discount', null, v_discount_description, -v_discount_cents, 0, 1);
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

drop function if exists public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb);

revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb, text, numeric, text) from public;
revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb, text, numeric, text) from anon;
grant execute on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method, uuid[], jsonb, text, numeric, text) to authenticated;

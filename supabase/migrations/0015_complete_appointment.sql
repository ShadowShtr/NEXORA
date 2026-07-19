-- NEX-110/NEX-113: "Modal de conclusão rápida" + "Transação de conclusão" —
-- (docs/01_PRODUCT_REQUIREMENTS.md §9: "janela rápida mostra valor e forma de
-- pagamento; métodos: dinheiro, MB WAY ou pendente") "Appointment/payment/audit
-- atualizados atomically" is this task's own acceptance criterion: a single
-- plpgsql function, not three separate client-side calls, so a failure partway
-- through (e.g. a constraint violation) rolls back everything rather than leaving an
-- appointment marked completed with no matching payment row.
--
-- p_final_total_cents is the owner-adjustable final value shown in the quick panel
-- (product: "preços selecionados são base; valor final é ajustável") — always trusted
-- from the caller here, unlike booking creation's price snapshots, because completing
-- an appointment is an authenticated owner action on her own tenant's data, not a
-- public-facing price computation an attacker could manipulate to steal a discount.
-- p_method is null only when p_status = 'pending' (mirrors the payments table's own
-- check constraint, 0001_initial.sql) — a paid completion always records a method.
create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_final_total_cents bigint,
  p_payment_status public.payment_status,
  p_payment_method public.payment_method
)
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

revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method) from public;
revoke all on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method) from anon;
grant execute on function public.complete_appointment(uuid, bigint, public.payment_status, public.payment_method) to authenticated;

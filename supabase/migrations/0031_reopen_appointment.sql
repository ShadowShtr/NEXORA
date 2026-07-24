-- NEX-115: "Reabrir/corrigir com auditoria" — lets the owner undo a completion made in
-- error (wrong payment method, wrong extras) without losing the trail of what happened.
--
-- Reverts appointment status to 'confirmed' and clears completed_at/final_total_cents.
-- appointment_items added by complete_appointment (source_type in ('manual_extra',
-- 'discount')) are removed — they only ever existed as a byproduct of that completion —
-- while the original 'service'/'package' items are left untouched, since those are the
-- marcação itself, not something the completion added. The payment row is not deleted
-- (that would erase financial history); it is marked 'refunded', the status this schema
-- already uses for "a completed charge that no longer reflects reality" — the only
-- semantically correct choice, since 'pending' would falsely imply the client still owes
-- money and there is no fourth status for "reversed by owner action".
--
-- audit_logs stores a full snapshot of the pre-reopen state (status, final_total_cents,
-- removed items, the payment's prior status) so the completion this undoes remains
-- reconstructable — "corrigir com auditoria" requires the history to survive the
-- correction, not just the correction itself.
create or replace function public.reopen_appointment(
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment record;
  v_payment record;
  v_removed_items jsonb;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status, final_total_cents into v_appointment
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'appointment % not found for tenant', p_appointment_id using errcode = '22023';
  end if;
  if v_appointment.status <> 'completed' then
    raise exception 'appointment % cannot be reopened from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceType', source_type, 'description', description, 'unitPriceCents', unit_price_cents
  )), '[]'::jsonb) into v_removed_items
  from public.appointment_items
  where appointment_id = p_appointment_id and source_type in ('manual_extra', 'discount');

  delete from public.appointment_items
  where appointment_id = p_appointment_id and source_type in ('manual_extra', 'discount');

  update public.appointments
  set status = 'confirmed', completed_at = null, final_total_cents = null
  where id = p_appointment_id;

  select id, status, method, amount_cents into v_payment
  from public.payments
  where appointment_id = p_appointment_id
  order by created_at desc
  limit 1
  for update;

  if found and v_payment.status <> 'refunded' then
    update public.payments
    set status = 'refunded', updated_at = now()
    where id = v_payment.id;
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'appointment.reopened', 'appointment', p_appointment_id,
    jsonb_build_object(
      'previous_status', v_appointment.status,
      'previous_final_total_cents', v_appointment.final_total_cents,
      'removed_items', v_removed_items,
      'previous_payment_id', v_payment.id,
      'previous_payment_status', v_payment.status,
      'previous_payment_amount_cents', v_payment.amount_cents
    )
  );
end;
$$;

revoke all on function public.reopen_appointment(uuid) from public;
revoke all on function public.reopen_appointment(uuid) from anon;
grant execute on function public.reopen_appointment(uuid) to authenticated;

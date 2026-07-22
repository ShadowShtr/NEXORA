-- NEX-114: "Área de pagamentos pendentes" — marking a pending payment as paid records
-- a real-world event (the dona actually received cash/MB WAY afterwards), not a
-- correction of a mistake — that's NEX-115's "reabrir/corrigir com auditoria", a
-- separate, not-yet-built ticket. This only ever advances 'pending' -> 'paid'; there is
-- no path back from 'paid' through this function, matching the payments table's own
-- check constraint (0001_initial.sql: status='pending' iff method/paid_at are null).
create or replace function public.mark_payment_paid(p_payment_id uuid, p_method public.payment_method)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_payment record;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  select id, status, amount_cents into v_payment
  from public.payments
  where id = p_payment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'payment % not found for tenant', p_payment_id using errcode = '22023';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'payment % is not pending', p_payment_id using errcode = '22023';
  end if;

  update public.payments
  set status = 'paid', method = p_method, paid_at = now(), updated_at = now()
  where id = p_payment_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'payment.marked_paid', 'payment', p_payment_id,
    jsonb_build_object('method', p_method, 'amount_cents', v_payment.amount_cents)
  );
end;
$$;

-- New functions in `public` are reachable by anon/authenticated by default on this
-- project (ADR-008) — revoking from PUBLIC alone does not undo that, so both are
-- revoked explicitly before re-granting only to authenticated.
revoke all on function public.mark_payment_paid(uuid, public.payment_method) from public;
revoke all on function public.mark_payment_paid(uuid, public.payment_method) from anon;
grant execute on function public.mark_payment_paid(uuid, public.payment_method) to authenticated;

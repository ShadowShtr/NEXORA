-- NEX-123: "Editar escopo da série" — "Alterações: apenas ocorrência, ocorrência e
-- próximas, ou toda a série" (docs/01_PRODUCT_REQUIREMENTS.md §7). "Apenas ocorrência"
-- is already cancel_appointment (0008_cancel_reschedule_appointment.sql, NEX-084) —
-- unchanged, no need to duplicate it here. This adds the two multi-row scopes only:
-- cancel every still-cancellable appointment in the same recurring_series, either from
-- p_appointment_id onward ('this_and_future') or the whole series regardless of date
-- ('all'). A single UPDATE ... RETURNING collects every affected id and takes the row
-- locks implicitly (no separate SELECT ... FOR UPDATE — that combination doesn't work
-- with the array_agg aggregation needed to report back which ids were touched), so this
-- is atomic the same way NEX-122's create_recurring_series is: an error partway through
-- would abort the whole statement, leaving nothing partially cancelled.
create or replace function public.cancel_recurring_series(
  p_appointment_id uuid,
  p_scope text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment record;
  v_cancelled_ids uuid[];
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  if p_scope not in ('this_and_future', 'all') then
    raise exception 'invalid scope %, expected this_and_future or all', p_scope using errcode = '22023';
  end if;

  select id, status, start_at, recurring_series_id into v_appointment
  from public.appointments
  where id = p_appointment_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'appointment % not found for tenant', p_appointment_id using errcode = '22023';
  end if;
  if v_appointment.recurring_series_id is null then
    raise exception 'appointment % does not belong to a recurring series', p_appointment_id
      using errcode = '22023';
  end if;
  if v_appointment.status in ('cancelled', 'completed', 'no_show') then
    raise exception 'appointment % cannot be cancelled from status %', p_appointment_id, v_appointment.status
      using errcode = '22023';
  end if;

  with cancelled as (
    update public.appointments
    set status = 'cancelled', cancelled_at = now()
    where tenant_id = v_tenant_id
      and recurring_series_id = v_appointment.recurring_series_id
      and status in ('confirmed', 'presence_confirmed')
      and (p_scope = 'all' or start_at >= v_appointment.start_at)
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into v_cancelled_ids from cancelled;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(), 'recurring_series.cancelled', 'recurring_series', v_appointment.recurring_series_id,
    jsonb_build_object(
      'scope', p_scope,
      'triggered_from_appointment_id', p_appointment_id,
      'cancelled_appointment_ids', to_jsonb(v_cancelled_ids),
      'cancelled_count', coalesce(array_length(v_cancelled_ids, 1), 0)
    )
  );

  return coalesce(array_length(v_cancelled_ids, 1), 0);
end;
$$;

revoke all on function public.cancel_recurring_series(uuid, text) from public;
revoke all on function public.cancel_recurring_series(uuid, text) from anon;
grant execute on function public.cancel_recurring_series(uuid, text) to authenticated;

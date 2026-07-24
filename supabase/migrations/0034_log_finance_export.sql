-- NEX-135: "Regras de retenção/exportação — limites, logging e acesso seguro."
--
-- Limites: resolvePeriod/resolveCustomRange (src/features/finance/domain/period.ts,
-- NEX-131) already clamp any custom range to at most 366 days before any export route
-- (NEX-132/133/134) ever queries the database — tested since NEX-131
-- (tests/unit/finance-period.test.ts: "clamps a pathologically wide range instead of
-- resolving unbounded years of data"). Nothing new needed here.
--
-- Acesso seguro: every export route already gates on requireProfile()'s own session
-- check (unchanged) before ever calling this function; current_tenant_id() below is the
-- same server-side authorization boundary every other RPC in this codebase relies on.
--
-- Logging: the piece that was missing — an audit trail of who exported what financial
-- data, when, and for how wide a range. A single row per export (not per transaction
-- row), matching the audit_logs convention already used for bulk actions
-- (create_recurring_series, NEX-122).
create or replace function public.log_finance_export(
  p_format text,
  p_view text,
  p_range_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  if p_format not in ('csv', 'xlsx', 'pdf') then
    raise exception 'invalid export format %', p_format using errcode = '22023';
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, metadata)
  values (
    v_tenant_id, auth.uid(), 'finance.exported', 'finance_export',
    jsonb_build_object('format', p_format, 'view', p_view, 'range_days', p_range_days)
  );
end;
$$;

revoke all on function public.log_finance_export(text, text, integer) from public;
revoke all on function public.log_finance_export(text, text, integer) from anon;
grant execute on function public.log_finance_export(text, text, integer) to authenticated;

-- PR4 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR4 update): replaces the fan-out
-- src/app/(dashboard)/dashboard/page.tsx's loadDashboardData() used to do — 4 Supabase
-- calls (appointments today, reminders count, payments paid today, attention reminders)
-- plus a 5th dependent call (pending payments for today's appointment ids, which can
-- only run after the first resolves) — with one RPC. Same values, same rules, moved to
-- Postgres; no new metric this Dashboard didn't already show.
--
-- Naming: `_v1` suffix (not a generic `get_dashboard_data`) — the return shape is a
-- contract the React loader parses field-by-field; a future breaking change gets a
-- `_v2` function instead of an in-place change that silently breaks the old contract
-- for anyone still calling `_v1` mid-deploy.
--
-- Security: p_tenant_id is deliberately NOT a parameter. tenant_id is derived from
-- public.current_tenant_id() (auth.uid() -> profiles.tenant_id, 0001_initial.sql) —
-- same pattern as cancel_appointment/reschedule_appointment
-- (0008_cancel_reschedule_appointment.sql). A caller has no parameter to tamper with to
-- reach another tenant's data in the first place, which is a stronger guarantee than
-- accepting p_tenant_id and validating it against auth.uid() after the fact.
--
-- Row-multiplication: appointment_items is one-to-many per appointment (a booking can
-- have several services/extras) — aggregated into an array in `item_totals` *before*
-- being joined to appointments, so an appointment with 3 items never produces 3 rows.
-- reminders(appointment_id) is one-to-one (unique constraint, 0001_initial.sql), so
-- joining reminders -> appointments -> clients cannot multiply rows either. payments
-- totals are computed with a plain aggregate directly over the payments table, never
-- joined row-by-row to appointments/items, so multiple payments per appointment are
-- summed once each, not multiplied by item count.
--
-- Day boundary: p_day_start/p_day_end are passed in as absolute timestamptz, resolved
-- by the caller from the tenant's configured timezone (src/app/(dashboard)/dashboard/
-- page.tsx already does this correctly via date-fns-tz's fromZonedTime, confirmed in
-- PR1's audit) — this function does no timezone math of its own, only a semi-open
-- interval comparison (`>= start and < end`), which is what a DST-safe boundary
-- resolved upstream needs on the SQL side: no BETWEEN (which is inclusive on both
-- ends and could double-count a row starting exactly at the next day's boundary).
create or replace function public.get_dashboard_summary_v1(
  p_day_start timestamptz,
  p_day_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_result jsonb;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;
  if p_day_start is null or p_day_end is null or p_day_end <= p_day_start then
    raise exception 'invalid day range' using errcode = '22023';
  end if;

  with item_totals as (
    select
      ai.appointment_id,
      -- created_at order approximates the original PostgREST-embedded read
      -- (`appointment_items(description)`), which never specified an explicit order —
      -- insertion order is the closest faithful equivalent, not a behavior change.
      array_agg(ai.description order by ai.created_at) as item_descriptions
    from public.appointment_items ai
    where ai.tenant_id = v_tenant_id
    group by ai.appointment_id
  ),
  today_appointments as (
    select
      a.id,
      a.start_at,
      a.end_at,
      a.status,
      -- Matches the JS side's `row.final_total_cents ?? row.expected_total_cents`
      -- exactly — coalesce() and `??` both treat SQL NULL / JS null the same way here.
      coalesce(a.final_total_cents, a.expected_total_cents) as total_cents,
      c.name as client_name,
      c.phone_e164 as client_phone_e164,
      coalesce(it.item_descriptions, array[]::text[]) as item_descriptions
    from public.appointments a
    join public.clients c on c.id = a.client_id
    left join item_totals it on it.appointment_id = a.id
    where a.tenant_id = v_tenant_id
      and a.start_at >= p_day_start
      and a.start_at < p_day_end
  ),
  received_today as (
    -- "Faturação recebida hoje": payments *paid* today (paid_at), independent of which
    -- calendar day the underlying appointment itself falls on — matches the pre-RPC
    -- loader exactly (it queried payments.paid_at, never joined to today_appointments
    -- for this figure). Not the same rule as invoicedTodayCents (a pure-JS aggregate
    -- over today's *active* appointments' totals, computed client-side in
    -- buildDashboardSummary and unchanged by this migration).
    select coalesce(sum(amount_cents), 0)::bigint as total_cents
    from public.payments
    where tenant_id = v_tenant_id
      and status = 'paid'
      and paid_at >= p_day_start
      and paid_at < p_day_end
  ),
  pending_today as (
    -- Pending payments *for today's appointments specifically* — the one query in the
    -- old loader that genuinely depended on the first (it built an `.in(appointment_id,
    -- todayApptIds)` filter from the first query's result). Here it's just a subquery
    -- against the same CTE, same dependency, one round trip instead of two.
    select
      coalesce(sum(p.amount_cents), 0)::bigint as total_cents,
      count(*)::int as payments_count
    from public.payments p
    where p.tenant_id = v_tenant_id
      and p.status = 'pending'
      and p.appointment_id in (select id from today_appointments)
  ),
  pending_reminders as (
    -- Tenant-wide pending reminder count, deliberately not date-scoped — matches the
    -- pre-RPC loader exactly (it filtered only by tenant_id + status = 'pending', no
    -- due_at range), even though the UI label reads "Lembretes Hoje". Preserving the
    -- existing rule verbatim per this PR's mandate, not fixing a possibly-misleading
    -- label — that's a product decision out of scope here.
    select count(*)::int as total
    from public.reminders
    where tenant_id = v_tenant_id and status = 'pending'
  ),
  attention_reminders as (
    select
      r.id,
      r.due_at,
      a.id as appointment_id,
      a.start_at as appointment_start_at,
      c.name as client_name,
      c.phone_e164 as client_phone_e164,
      coalesce(it.item_descriptions, array[]::text[]) as item_descriptions
    from public.reminders r
    join public.appointments a on a.id = r.appointment_id
    join public.clients c on c.id = a.client_id
    left join item_totals it on it.appointment_id = a.id
    where r.tenant_id = v_tenant_id and r.status = 'pending'
    order by r.due_at
    limit 4
  )
  select jsonb_build_object(
    'appointments_today',
      coalesce(
        (select jsonb_agg(to_jsonb(ta) order by ta.start_at) from today_appointments ta),
        '[]'::jsonb
      ),
    'attention_reminders',
      coalesce(
        (select jsonb_agg(to_jsonb(ar) order by ar.due_at) from attention_reminders ar),
        '[]'::jsonb
      ),
    'pending_reminders_count', (select total from pending_reminders),
    'received_today_cents', (select total_cents from received_today),
    'pending_today_cents', (select total_cents from pending_today),
    'pending_payments_today_count', (select payments_count from pending_today)
  )
  into v_result;

  return v_result;
end;
$$;

-- ADR-008: revoke from public and anon explicitly (a bare `revoke ... from public`
-- does not remove this Supabase project's default direct grants to anon/authenticated),
-- then grant only to authenticated — a signed-in owner's session is the only caller
-- this function should ever accept; there is no legitimate anonymous use of a private
-- Dashboard summary.
revoke all on function public.get_dashboard_summary_v1(timestamptz, timestamptz) from public;
revoke all on function public.get_dashboard_summary_v1(timestamptz, timestamptz) from anon;
grant execute on function public.get_dashboard_summary_v1(timestamptz, timestamptz) to authenticated;

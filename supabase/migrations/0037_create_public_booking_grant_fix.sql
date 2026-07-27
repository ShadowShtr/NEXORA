-- NEX-166 (security review): 0023_create_public_booking_observation.sql added
-- p_client_observation as a new trailing parameter, which — because Postgres
-- overloads functions by full argument signature — created a *new* 9-argument
-- function distinct from the 8-argument one, rather than modifying it in place.
-- Every other migration in this project that creates or replaces a
-- `security definer` function re-applies its own `revoke`/`grant` (ADR-008: this
-- project grants EXECUTE to anon/authenticated by default on new `public` schema
-- functions, so omitting the revoke leaves it reachable by both). 0023 missed this,
-- so the 9-argument overload — the only one left after
-- 0024_drop_create_public_booking_8arg_overload.sql dropped the 8-argument one —
-- has been running since with default grants instead of anon-only.
--
-- Low practical exposure (the function is meant to be anon-callable anyway, and it
-- validates tenant_id/published status internally regardless of caller), but it's a
-- real, untested deviation from the documented grant policy — closing it here and
-- adding the missing negative test alongside.
revoke all on function public.create_public_booking(
  uuid, text, text, text, uuid[], uuid, timestamptz, text, text
) from public;
revoke all on function public.create_public_booking(
  uuid, text, text, text, uuid[], uuid, timestamptz, text, text
) from authenticated;
grant execute on function public.create_public_booking(
  uuid, text, text, text, uuid[], uuid, timestamptz, text, text
) to anon;

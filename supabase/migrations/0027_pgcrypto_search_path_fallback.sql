-- 0020_fix_pgcrypto_schema.sql moved the pgcrypto extension into `public` so that
-- digest()/gen_random_bytes() would resolve under this codebase's `set search_path =
-- public` convention (ADR-008). That works against the hosted Supabase project this app
-- actually runs on — confirmed live via create_manual_booking, which has been calling
-- digest() successfully in production all session.
--
-- It does not reliably hold on every fresh Postgres bootstrap, though: CI's
-- `integration` job (supabase start against a brand-new local stack, replaying every
-- migration from scratch) has been failing since the public-booking-flow-redesign merge
-- with "function digest(text, unknown) does not exist" (42883) inside
-- create_public_booking and resolve_booking_lookup_code — i.e. 0020's ALTER EXTENSION
-- does not put pgcrypto somewhere these functions' search_path can find it on that
-- particular bootstrap path, even though the same migration set is fine against the
-- real project. Rather than chase exactly why extension relocation behaves differently
-- there, this makes the three functions that call digest()/gen_random_bytes() resilient
-- to either outcome: `extensions` is Supabase's own documented default location for
-- pgcrypto, so widening search_path to check it too (after public) costs nothing on the
-- environment where it's already in public, and fixes the one where it isn't.
alter function public.create_public_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text, text)
  set search_path = public, extensions;
alter function public.resolve_booking_lookup_code(text)
  set search_path = public, extensions;
alter function public.create_manual_booking(uuid, text, text, text, uuid[], uuid, timestamptz, text)
  set search_path = public, extensions;

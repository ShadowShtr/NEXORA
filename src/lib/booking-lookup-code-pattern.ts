// Split out from booking-lookup-code.ts (not just re-exported from there) so this pure
// regex can be unit-tested without pulling in createAdminClient — that import eagerly
// parses src/lib/env.ts's full schema at module load, which would make every test
// importing this file also require the full Supabase env to be set (the same reason
// rate-limit.ts reads process.env directly instead of going through serverEnv()).
//
// 8 characters, alphabet excludes 0/O/1/I/L (ambiguous when hand-copied from a screen
// or read aloud over a call) — matches '23456789ABCDEFGHJKMNPQRSTUVWXYZ', the exact
// alphabet the RPC itself generates from (supabase/migrations/0018_booking_lookup_code.sql,
// v_lookup_alphabet). Spelled out character-by-character rather than as a range
// (A-Z minus I/L/O isn't expressible as a contiguous range in a charclass) so it can't
// silently drift from the RPC's alphabet the way a range like [A-HJ-NP-Z] did on a
// first pass — that range still let 'L' through (J-N includes L), caught by this
// module's own unit test. Case-insensitive on input: the RPC upper()s before hashing,
// so this pattern accepts either case.
export const BOOKING_LOOKUP_CODE_PATTERN =
  /^[23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz]{8}$/;

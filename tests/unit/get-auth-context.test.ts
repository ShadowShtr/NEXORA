import { beforeEach, describe, expect, it, vi } from 'vitest';

// PR3 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR3 update): unit coverage for
// src/lib/auth/get-auth-context.ts and the requireProfile()/getOptionalProfile()
// wrappers now built on top of it. These tests verify branch correctness and the exact
// shape/count of calls made to the (mocked) Supabase client for a *single* invocation
// — not cross-call deduplication.
//
// Deliberately NOT tested here: whether two calls to requireProfile()/getOptionalProfile()
// within the same request share one underlying query. React's cache() only memoizes
// inside a real Next.js request render (a per-request dispatcher Next.js's server sets
// up internally) — calling a cache()-wrapped function directly in Vitest, with no such
// render in progress, does not dedupe at all. Verified empirically before writing this
// suite: a throwaway probe (`cache(async () => { calls++; return calls; })`, awaited
// twice in one test) came back `calls === 2`, not 1. A unit test that asserted a lower
// call count here would therefore be testing a mock's bookkeeping, not the real
// mechanism — actively misleading. That claim can only be proven by rendering through
// an actual Next.js server (dev or `next start`), which requires Supabase (Docker) —
// unavailable in the session this PR was written in (see the report's "Bloqueio de
// ambiente" section). This file's own pre-existing cache() usage
// (src/app/b/[slug]/page.tsx's `loadPublicProfile`) has the same, older, previously
// undocumented gap.

const getClaimsMock = vi.fn();
const signOutMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: getClaimsMock, signOut: signOutMock },
    from: fromMock,
  })),
}));

// next/navigation's real redirect() throws a special NEXT_REDIRECT error that Next's
// own rendering pipeline catches; outside that pipeline it would just be an uncaught
// throw. Mocked here as a plain, distinguishable throw so requireProfile()'s redirect
// paths are assertable without a real Next.js render.
class RedirectSignal extends Error {
  constructor(public destination: string) {
    super(`REDIRECT:${destination}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: vi.fn((destination: string) => {
    throw new RedirectSignal(destination);
  }),
}));

const { getAuthContext } = await import('@/lib/auth/get-auth-context');
const { requireProfile, getOptionalProfile } = await import('@/lib/auth/require-profile');

function mockUnauthenticated() {
  getClaimsMock.mockResolvedValue({ data: { claims: null } });
}

function mockAuthenticatedNoProfile(userId = 'user-1') {
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: userId } } });
  maybeSingleMock.mockResolvedValue({ data: null });
}

function mockAuthenticatedWithProfile(
  overrides: {
    userId?: string;
    tenantId?: string;
    tenantSlug?: string;
    displayName?: string;
    email?: string;
  } = {},
) {
  const userId = overrides.userId ?? 'user-1';
  getClaimsMock.mockResolvedValue({
    data: { claims: { sub: userId, email: overrides.email ?? 'owner@example.test' } },
  });
  maybeSingleMock.mockResolvedValue({
    data: {
      user_id: userId,
      tenant_id: overrides.tenantId ?? 'tenant-1',
      display_name: overrides.displayName ?? 'Ana',
      tenants: { slug: overrides.tenantSlug ?? 'ana-beleza' },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuthContext()', () => {
  it('returns { status: "unauthenticated" } when there are no valid claims', async () => {
    mockUnauthenticated();

    const result = await getAuthContext();

    expect(result).toEqual({ status: 'unauthenticated' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('treats claims with no `claims` payload the same as no session (claims inválidas)', async () => {
    getClaimsMock.mockResolvedValue({ data: {} });

    const result = await getAuthContext();

    expect(result).toEqual({ status: 'unauthenticated' });
  });

  it('returns { status: "no_profile", userId } when the user has valid claims but no profiles row', async () => {
    mockAuthenticatedNoProfile('user-42');

    const result = await getAuthContext();

    expect(result).toEqual({ status: 'no_profile', userId: 'user-42' });
  });

  it('treats a Supabase error on the profile query the same as "no profile" (data stays null)', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'connection reset', code: '57P01' },
    });

    const result = await getAuthContext();

    expect(result).toEqual({ status: 'no_profile', userId: 'user-1' });
  });

  it('returns the full profile (userId, tenantId, tenantSlug, displayName, email) on success', async () => {
    mockAuthenticatedWithProfile({
      userId: 'user-7',
      tenantId: 'tenant-7',
      tenantSlug: 'salao-sete',
      displayName: 'Beatriz',
      email: 'beatriz@example.test',
    });

    const result = await getAuthContext();

    expect(result).toEqual({
      status: 'ok',
      profile: {
        userId: 'user-7',
        tenantId: 'tenant-7',
        tenantSlug: 'salao-sete',
        displayName: 'Beatriz',
        email: 'beatriz@example.test',
      },
    });
  });

  it('normalizes an embedded `tenants` relation returned as an array (PostgREST can return either shape)', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        display_name: 'Ana',
        tenants: [{ slug: 'ana-beleza' }],
      },
    });

    const result = await getAuthContext();

    expect(result).toMatchObject({ status: 'ok', profile: { tenantSlug: 'ana-beleza' } });
  });

  it('falls back to empty strings for a missing display_name/tenant slug, never throwing', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({
      data: { user_id: 'user-1', tenant_id: 'tenant-1', display_name: null, tenants: null },
    });

    const result = await getAuthContext();

    expect(result).toMatchObject({
      status: 'ok',
      profile: { tenantSlug: '', displayName: '' },
    });
  });

  it('email falls back to null when the JWT carries none', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        display_name: 'Ana',
        tenants: { slug: 'ana-beleza' },
      },
    });

    const result = await getAuthContext();

    expect(result).toMatchObject({ status: 'ok', profile: { email: null } });
  });

  it('makes exactly one getClaims() call and one profiles query per invocation', async () => {
    mockAuthenticatedWithProfile();

    await getAuthContext();

    expect(getClaimsMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('never calls signOut() — that side effect belongs to requireProfile(), not the memoized resolver', async () => {
    mockAuthenticatedNoProfile();

    await getAuthContext();

    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('requireProfile()', () => {
  it('redirects to /login when unauthenticated', async () => {
    mockUnauthenticated();

    await expect(requireProfile()).rejects.toThrow(RedirectSignal);
    await expect(requireProfile()).rejects.toMatchObject({ destination: '/login' });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('signs the session out and redirects to /login?error=no_profile when authenticated with no profile', async () => {
    mockAuthenticatedNoProfile();

    await expect(requireProfile()).rejects.toMatchObject({
      destination: '/login?error=no_profile',
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('returns { userId, tenantId, tenantSlug, displayName } on success, without redirecting', async () => {
    mockAuthenticatedWithProfile({
      userId: 'user-7',
      tenantId: 'tenant-7',
      tenantSlug: 'salao-sete',
      displayName: 'Beatriz',
    });

    const result = await requireProfile();

    expect(result).toEqual({
      userId: 'user-7',
      tenantId: 'tenant-7',
      tenantSlug: 'salao-sete',
      displayName: 'Beatriz',
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('getOptionalProfile()', () => {
  it('returns null (never redirects, never signs out) when unauthenticated', async () => {
    mockUnauthenticated();

    const result = await getOptionalProfile();

    expect(result).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('returns null (never redirects, never signs out) when authenticated with no profile', async () => {
    mockAuthenticatedNoProfile();

    const result = await getOptionalProfile();

    expect(result).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('returns { userId, tenantId, tenantSlug, displayName } on success', async () => {
    mockAuthenticatedWithProfile({
      userId: 'user-3',
      tenantId: 'tenant-3',
      tenantSlug: 'salao-tres',
      displayName: 'Carla',
    });

    const result = await getOptionalProfile();

    expect(result).toEqual({
      userId: 'user-3',
      tenantId: 'tenant-3',
      tenantSlug: 'salao-tres',
      displayName: 'Carla',
    });
  });
});

describe('cross-user isolation (no leakage between separate calls in this suite)', () => {
  it('two consecutive calls for two different mocked users never mix tenant/profile data', async () => {
    mockAuthenticatedWithProfile({
      userId: 'user-a',
      tenantId: 'tenant-a',
      tenantSlug: 'salao-a',
      displayName: 'Utilizadora A',
    });
    const resultA = await getAuthContext();

    mockAuthenticatedWithProfile({
      userId: 'user-b',
      tenantId: 'tenant-b',
      tenantSlug: 'salao-b',
      displayName: 'Utilizadora B',
    });
    const resultB = await getAuthContext();

    expect(resultA).toMatchObject({ profile: { userId: 'user-a', tenantId: 'tenant-a' } });
    expect(resultB).toMatchObject({ profile: { userId: 'user-b', tenantId: 'tenant-b' } });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// NEX-135: "Acesso seguro" — requireProfile() is the single authorization gate every
// dashboard page and every finance export route (NEX-132/133/134) delegates to, so
// testing it once here covers all of them rather than re-testing the same redirect logic
// three times per route. Fully mocked (no real Supabase project needed): next/navigation's
// redirect() is replaced with a fake that throws the same "NEXT_REDIRECT" shape Next.js
// itself throws, and @/lib/supabase/server's createClient() is replaced with a minimal
// fake exposing only what requireProfile actually calls.
const redirectMock = vi.fn((url: string) => {
  throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;replace;${url};307;`,
  });
});
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

const getClaimsMock = vi.fn();
const signOutMock = vi.fn();
const maybeSingleMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getClaims: getClaimsMock, signOut: signOutMock },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  }),
}));

describe('requireProfile (NEX-135: authorization)', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getClaimsMock.mockReset();
    signOutMock.mockReset();
    maybeSingleMock.mockReset();
  });

  it('redirects to /login when there is no session', async () => {
    getClaimsMock.mockResolvedValue({ data: null });
    const { requireProfile } = await import('@/lib/auth/require-profile');

    await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('signs out and redirects when the session has no matching profile', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({ data: null });
    const { requireProfile } = await import('@/lib/auth/require-profile');

    await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT:/login?error=no_profile');
    expect(signOutMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/login?error=no_profile');
  });

  it('returns the tenant-scoped identity for a valid session with a profile, without redirecting', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
    maybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        display_name: 'Owner',
        // PR3: tenantSlug now comes from the same query (embedded `tenants(slug)`
        // relation) — src/lib/auth/get-auth-context.ts.
        tenants: { slug: 'owner-salon' },
      },
    });
    const { requireProfile } = await import('@/lib/auth/require-profile');

    await expect(requireProfile()).resolves.toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'owner-salon',
      displayName: 'Owner',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

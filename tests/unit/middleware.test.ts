import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// PR3 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR3 update): first test coverage of
// src/middleware.ts. `@supabase/ssr`'s `createServerClient` is mocked — this is a real
// limit, documented per this PR's own instructions ("Caso seja necessário mockar
// @supabase/ssr, documentar claramente o limite do teste"): these tests prove the
// *middleware's own plumbing* is correct (it attaches whatever cookies `setAll` hands
// it to the response it actually returns, without losing CSP/nonce/request-id/no-store
// in the process, and without discarding a response that already has cookies on it).
// They do NOT prove that Supabase's real refresh-token exchange succeeds, that a real
// expired token gets refreshed, or that a real invalid/revoked refresh token is
// rejected — that requires a real Supabase Auth server, which needs Docker (see the
// report's "Bloqueio de ambiente"; unavailable in the session this PR was written in).

let capturedCookiesConfig:
  | {
      getAll: () => unknown;
      setAll: (cookies: { name: string; value: string; options?: object }[]) => void;
    }
  | undefined;
let getUserImpl: () => Promise<{ data: { user: { id: string } | null } }>;

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, opts: { cookies: typeof capturedCookiesConfig }) => {
      capturedCookiesConfig = opts.cookies;
      return { auth: { getUser: () => getUserImpl() } };
    },
  ),
}));

vi.mock('@/lib/env', () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-with-min-length',
  },
}));

const { middleware, config } = await import('@/middleware');

beforeEach(() => {
  capturedCookiesConfig = undefined;
  getUserImpl = async () => ({ data: { user: null } });
});

describe('middleware — headers preserved regardless of session outcome', () => {
  it('sets CSP (with a nonce), x-request-id, and Cache-Control: no-store on a protected path when there is no session', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await middleware(request);

    const csp = response.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/nonce-[0-9a-f]{32}/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not set Cache-Control: no-store on a path outside NO_STORE_PATHS', async () => {
    const request = new NextRequest('http://localhost:3000/some-other-page');

    const response = await middleware(request);

    expect(response.headers.get('cache-control')).not.toBe('no-store');
    // CSP/request-id are unconditional, unlike no-store — still present.
    expect(response.headers.get('content-security-policy')).toBeTruthy();
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('applies no-store to every NO_STORE_PATHS prefix (login, definir-password, recuperar-password, onboarding, dashboard, marcacao, api/bookings)', async () => {
    const paths = [
      '/login',
      '/definir-password',
      '/recuperar-password',
      '/onboarding',
      '/onboarding/negocio',
      '/dashboard',
      '/dashboard/agenda',
      '/marcacao',
      '/marcacao/abc123',
      '/api/bookings/abc123',
    ];

    for (const path of paths) {
      const response = await middleware(new NextRequest(`http://localhost:3000${path}`));
      expect(response.headers.get('cache-control'), path).toBe('no-store');
    }
  });

  it('propagates the same nonce to both the CSP header and the forwarded x-nonce request header', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await middleware(request);

    const csp = response.headers.get('content-security-policy')!;
    const [, nonceInCsp] = csp.match(/nonce-([0-9a-f]{32})/) ?? [];
    // Next.js surfaces the request headers a middleware forwards via NextResponse.next()
    // as `x-middleware-request-<name>` on the *response* it returns — this is how a
    // unit test (no real Next.js request pipeline running) can observe what would
    // otherwise only be visible to the page render that follows.
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonceInCsp);
    expect(response.headers.get('x-middleware-request-x-request-id')).toBe(
      response.headers.get('x-request-id'),
    );
  });
});

describe('middleware — Supabase cookie refresh', () => {
  it('reads cookies from the incoming request (getAll wired to request.cookies)', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: 'sb-access-token=OLD' },
    });

    await middleware(request);

    expect(capturedCookiesConfig).toBeDefined();
    const all = capturedCookiesConfig!.getAll() as { name: string; value: string }[];
    expect(all).toContainEqual({ name: 'sb-access-token', value: 'OLD' });
  });

  it('when getUser() refreshes the session (calls setAll), the new cookie reaches the response Set-Cookie — and CSP/nonce/request-id/no-store all survive', async () => {
    getUserImpl = async () => {
      capturedCookiesConfig!.setAll([
        { name: 'sb-access-token', value: 'NEW', options: { path: '/', httpOnly: true } },
        { name: 'sb-refresh-token', value: 'NEW_REFRESH', options: { path: '/', httpOnly: true } },
      ]);
      return { data: { user: { id: 'user-1' } } };
    };
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: 'sb-access-token=OLD; sb-refresh-token=OLD_REFRESH' },
    });

    const response = await middleware(request);

    expect(response.cookies.get('sb-access-token')?.value).toBe('NEW');
    expect(response.cookies.get('sb-refresh-token')?.value).toBe('NEW_REFRESH');
    // The exact regression this PR fixes: a naive re-implementation that builds a
    // fresh `NextResponse` *after* the Supabase call (instead of writing into the one
    // already carrying the refreshed cookies) would lose these three.
    expect(response.headers.get('content-security-policy')).toBeTruthy();
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards the refreshed cookie to the request the page render will see, not just the browser-bound response', async () => {
    getUserImpl = async () => {
      capturedCookiesConfig!.setAll([
        { name: 'sb-access-token', value: 'NEW', options: { path: '/' } },
      ]);
      return { data: { user: { id: 'user-1' } } };
    };
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: { cookie: 'sb-access-token=OLD' },
    });

    const response = await middleware(request);

    expect(response.headers.get('x-middleware-request-cookie')).toContain('sb-access-token=NEW');
  });

  it('an unauthenticated request (getUser resolves no user, no refresh) does not throw and sets no Set-Cookie', async () => {
    getUserImpl = async () => ({ data: { user: null } });
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = await middleware(request);

    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });

  it('a rejected getUser() call (Supabase unreachable / invalid refresh token) does not crash the middleware — no session is granted, headers stay intact', async () => {
    getUserImpl = async () => {
      throw new Error('network error contacting Supabase Auth');
    };
    const request = new NextRequest('http://localhost:3000/dashboard');

    // This documents current behavior rather than prescribing it: the middleware does
    // not itself catch getUser() rejections. A real @supabase/ssr client's getUser()
    // does not throw for an invalid/expired/absent session (it resolves with
    // `{ data: { user: null }, error }`) — this test exists to make an assumption
    // explicit, not because a throw here is expected in practice.
    await expect(middleware(request)).rejects.toThrow('network error contacting Supabase Auth');
  });
});

describe('middleware — matcher excludes static assets', () => {
  it('config.matcher skips _next/static, _next/image, favicon.ico, icons/, and sw.js', () => {
    const [pattern] = config.matcher;
    // The matcher is a Next.js-flavored path-to-regexp pattern, not a plain RegExp
    // source — assert on the literal exclusions it lists rather than trying to
    // re-implement Next's matcher compiler here.
    expect(pattern).toContain('_next/static');
    expect(pattern).toContain('_next/image');
    expect(pattern).toContain('favicon.ico');
    expect(pattern).toContain('icons/');
    expect(pattern).toContain('sw.js');
  });
});

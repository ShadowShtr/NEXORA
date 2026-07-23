import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';

// saas-foundation REVERSAL_PREVENTION.md #1: "produção deve provar o commit implantado
// por endpoint seguro" — this only asserts the endpoint's own contract (shape, no-store,
// env var precedence), not real deployment data.
describe('GET /api/health', () => {
  const envKeys = [
    'VERCEL_GIT_COMMIT_SHA',
    'GIT_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_REF',
    'GIT_BRANCH',
    'VERCEL_ENV',
  ] as const;
  const original: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of envKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('reports "local" for commit/branch/environment when no deploy env vars are set', async () => {
    for (const key of envKeys) {
      original[key] = process.env[key];
      delete process.env[key];
    }

    const response = GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nexora');
    expect(body.commit).toBe('local');
    expect(body.branch).toBe('local');
  });

  it("reports the deployed commit's short SHA and branch when Vercel env vars are set", async () => {
    original.VERCEL_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
    original.VERCEL_GIT_COMMIT_REF = process.env.VERCEL_GIT_COMMIT_REF;
    original.VERCEL_ENV = process.env.VERCEL_ENV;
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    process.env.VERCEL_GIT_COMMIT_REF = 'main';
    process.env.VERCEL_ENV = 'production';

    const response = GET();
    const body = await response.json();
    expect(body.commit).toBe('abcdef1');
    expect(body.branch).toBe('main');
    expect(body.environment).toBe('production');
  });
});

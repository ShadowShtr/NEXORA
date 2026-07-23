import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// saas-foundation REVERSAL_PREVENTION.md #1: "Commit implantado é verificável" —
// "produção deve provar o commit implantado por endpoint seguro" (CLAUDE.md). Vercel
// sets these at build time for every deployment; GIT_COMMIT_SHA/GIT_BRANCH are the
// generic fallback for any non-Vercel environment (local dev, another host).
function deployedCommit() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null;
  return {
    commit: sha ? sha.slice(0, 7) : 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? 'local',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local',
  };
}

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'nexora',
      timestamp: new Date().toISOString(),
      ...deployedCommit(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

import { headers } from 'next/headers';

// Vercel (and most reverse proxies) set x-forwarded-for to "client, proxy1, proxy2" —
// the first entry is the original client. No req object is available inside a Server
// Action, so this reads from next/headers instead of an Express-style req.ip.
export async function getRequestIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) return first.trim();
  }
  const realIp = headerList.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

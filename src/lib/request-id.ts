import { headers } from 'next/headers';

// NEX-170: pairs with the request id src/middleware.ts generates per request and sets
// on the `x-request-id` request header — reads it back so Server
// Components/Actions/Route Handlers can stamp log lines (src/lib/logger.ts) with the
// same id, letting every log line from one request be correlated in Vercel's log
// viewer. Returns null outside a request context (e.g. a script) rather than
// generating a fallback id — a log line with requestId: null is honestly "no request
// context", not a fake correlation that looks real but never matches anything else.
export async function getRequestId(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get('x-request-id');
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// NEX-153: "Estratégia de cache segura — assets somente; no-store para auth/booking
// token." Extracts `isCacheableAssetPath` straight out of public/sw.js's real source
// text (not a duplicated copy, same technique as design-tokens-contrast.test.ts for
// globals.css) so this test can never drift from what's actually shipped to the
// browser — public/sw.js is a plain static file, not bundled or type-checked by
// anything else in the pipeline.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swSource = readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf-8');

const match = swSource.match(/function isCacheableAssetPath\(pathname\) \{[\s\S]*?\n\}/);
if (!match) throw new Error('isCacheableAssetPath not found in public/sw.js');
const isCacheableAssetPath: (pathname: string) => boolean = new Function(
  `return (${match[0].replace('function isCacheableAssetPath', 'function')})`,
)();

describe('service worker — cacheable asset allowlist (public/sw.js)', () => {
  it('caches Next.js static build assets', () => {
    expect(isCacheableAssetPath('/_next/static/chunks/main.js')).toBe(true);
    expect(isCacheableAssetPath('/_next/static/css/app.css')).toBe(true);
  });

  it('caches PWA icons', () => {
    expect(isCacheableAssetPath('/icons/icon-512.png')).toBe(true);
    expect(isCacheableAssetPath('/icons/apple-touch-icon.png')).toBe(true);
  });

  it.each([
    '/api/bookings/some-secret-token',
    '/marcacao/some-secret-token',
    '/login',
    '/dashboard',
    '/dashboard/financeiro',
    '/onboarding',
    '/definir-password',
    '/recuperar-password',
    '/b/some-tenant-slug',
    '/manifest.webmanifest',
    '/',
  ])('never caches %s', (pathname) => {
    expect(isCacheableAssetPath(pathname)).toBe(false);
  });
});

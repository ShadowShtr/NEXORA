// NEX-153: "Estratégia de cache segura — assets somente; no-store para auth/booking
// token." Deliberately minimal and hand-written rather than a generated Workbox
// bundle (CLAUDE.md: no new dependency without a demonstrated need) — a single
// allowlist of static asset paths is cached; everything else is left completely
// untouched by this service worker (fetch is never intercepted for it), so the
// browser's normal network behaviour — and this app's own explicit
// `Cache-Control: no-store` on auth/booking routes (next.config.ts) — applies
// unmodified. Registered from src/features/shell/ServiceWorkerRegistration.tsx.

const CACHE_NAME = 'nexora-assets-v1';

// Kept as a small, self-contained, pure function (no reference to `self`/`caches`/
// other service-worker-only globals) so it can be extracted and unit-tested directly
// from this file's real source text — see tests/unit/service-worker-cache-policy.test.ts.
// `/_next/static/*` is content-hashed and immutable (safe to cache indefinitely);
// `/icons/*` is not hashed, so CACHE_NAME must be bumped by hand if those files ever
// change again after a deploy.
function isCacheableAssetPath(pathname) {
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/');
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!isCacheableAssetPath(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});

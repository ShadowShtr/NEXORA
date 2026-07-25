'use client';

import { useEffect } from 'react';

// NEX-153/152: registers the assets-only service worker (public/sw.js). Also a
// prerequisite for NEX-152's install prompt on Chrome/Android — a registered service
// worker with a fetch handler is part of Chrome's own installability criteria, so
// `beforeinstallprompt` may not fire at all without one.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability/offline caching is a progressive enhancement here, not a
      // requirement for the app to function — a failed registration (unsupported
      // browser, blocked by an extension, etc.) shouldn't surface as a user-facing error.
    });
  }, []);

  return null;
}

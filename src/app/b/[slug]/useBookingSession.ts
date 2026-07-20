'use client';

import { useEffect, useState } from 'react';
import { resumeBookingDraft, saveBookingDraft } from './draft-actions';
import { EMPTY_DRAFT_PAYLOAD, type DraftPayload } from './domain/draft';

// Visual refinement mid-2026: the booking flow moved from one scrolling page with
// progressive disclosure to separate pages per step (/servicos, /horario, /dados,
// /resumo) — each is a fresh navigation, so React state can't carry the selection
// between them. The existing same-device draft (NEX-052, booking_drafts table +
// resume token in localStorage) already round-trips exactly this shape; this hook
// reuses it as the state carrier for every step, not just "seus dados" onward, instead
// of inventing a second, parallel storage mechanism.
function draftStorageKey(tenantSlug: string) {
  return `nexora-draft-${tenantSlug}`;
}

// Fast, same-tab cache: awaiting the DB round trip before every "Continuar" (and again
// re-fetching it back on the next page's mount) made a 4-step flow feel like 8 network
// round trips end to end — visibly "travado" between steps. sessionStorage survives
// navigation and reload within the tab, so the very next page can read the state back
// synchronously, no network wait, while the DB save happens in the background purely
// for cross-tab/after-closing-the-tab resume (NEX-052's original purpose). Session-,
// not local-, storage: it's a per-visit cache, not the durable resume mechanism (that's
// still the token in localStorage).
function sessionStateKey(tenantSlug: string) {
  return `nexora-draft-state-${tenantSlug}`;
}

export function useBookingSession(tenantId: string, tenantSlug: string) {
  const [state, setState] = useState<DraftPayload>(EMPTY_DRAFT_PAYLOAD);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cachedRaw = window.sessionStorage.getItem(sessionStateKey(tenantSlug));
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as DraftPayload;
          if (!cancelled) {
            setState(cached);
            setReady(true);
          }
          return;
        } catch {
          // Corrupt cache entry — fall through to the DB-backed resume below instead of
          // getting stuck on unparsable JSON.
        }
      }

      const token = window.localStorage.getItem(draftStorageKey(tenantSlug));
      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }
      const result = await resumeBookingDraft(token);
      if (cancelled) return;
      if (result.ok) {
        setState(result.value);
      } else {
        window.localStorage.removeItem(draftStorageKey(tenantSlug));
      }
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Synchronous, not awaited: state and the fast cache update immediately (so the
  // caller can navigate right away — the next page's mount reads the cache, not the
  // network), while the actual DB draft save happens in the background. A failed
  // background save only degrades resume-after-leaving-the-tab, which is a much lower
  // stake than blocking every step of an in-progress booking on a network round trip —
  // the booking itself is still created (and fully error-handled) from the resumo step.
  function persist(next: DraftPayload): void {
    setState(next);
    window.sessionStorage.setItem(sessionStateKey(tenantSlug), JSON.stringify(next));
    const token = window.localStorage.getItem(draftStorageKey(tenantSlug));
    saveBookingDraft(tenantId, token, next)
      .then((result) => {
        if (result.ok) {
          window.localStorage.setItem(draftStorageKey(tenantSlug), result.value.resumeToken);
        }
      })
      .catch(() => {
        // Best-effort — see the persist() comment above.
      });
  }

  function clear() {
    window.localStorage.removeItem(draftStorageKey(tenantSlug));
    window.sessionStorage.removeItem(sessionStateKey(tenantSlug));
  }

  return { state, ready, persist, clear };
}

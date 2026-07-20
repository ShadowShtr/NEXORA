'use client';

import { useEffect, useState } from 'react';
import { resumeBookingDraft, saveBookingDraft } from './draft-actions';
import { EMPTY_DRAFT_PAYLOAD, type DraftPayload } from './domain/draft';
import type { Result } from '@/lib/result';

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

export function useBookingSession(tenantId: string, tenantSlug: string) {
  const [state, setState] = useState<DraftPayload>(EMPTY_DRAFT_PAYLOAD);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

  // Explicit save on advancing a step, not a continuous debounced autosave — a
  // multi-page flow already has a natural save point (the moment the visitor commits to
  // "Continuar" and the next page needs the data), so there's no keystroke-races-navigation
  // window to guard against, and no empty/throwaway drafts from a page visited without
  // ever changing anything.
  async function persist(next: DraftPayload): Promise<Result<null>> {
    setState(next);
    const token = window.localStorage.getItem(draftStorageKey(tenantSlug));
    const result = await saveBookingDraft(tenantId, token, next);
    if (!result.ok) return result;
    window.localStorage.setItem(draftStorageKey(tenantSlug), result.value.resumeToken);
    return { ok: true, value: null };
  }

  function clear() {
    window.localStorage.removeItem(draftStorageKey(tenantSlug));
  }

  return { state, ready, persist, clear };
}

'use client';

import { useEffect, useState } from 'react';

// Shared by every page with a fixed floating action button sitting over a scrollable
// list (AgendaFab, ClientsFab): no amount of trailing padding on the list can prevent a
// fixed-position FAB from visually landing on the last real item when the page is short
// enough not to need scrolling — padding placed after content never moves that content.
// This watches a sentinel element placed at the true end of the list (before any
// reserved trailing padding) and reports true only when that point falls inside the
// FAB's own footprint, so the caller can fade the FAB out exactly then — and only then,
// leaving it visible on short lists, mid-scroll, and past the end of a scrolled list.
export function useFabHidesNearListEnd(
  sentinelId: string,
  fabFootprintPx: number,
  dangerBufferPx = 24,
): boolean {
  const [nearListEnd, setNearListEnd] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;

    function update() {
      const top = sentinel!.getBoundingClientRect().top;
      const fabTop = window.innerHeight - fabFootprintPx;
      setNearListEnd(top < window.innerHeight && top > fabTop - dangerBufferPx);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sentinelId, fabFootprintPx, dangerBufferPx]);

  return nearListEnd;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

// FAB's own footprint (globals.css .agenda-fab): 56px tall, bottom: 92px + safe-area.
const FAB_TOP_OFFSET_PX = 92 + 56;
const FAB_DANGER_BUFFER_PX = 24;

// Visual refinement mid-2026: a fixed bottom-right FAB will inevitably overlap the last
// timeline card's action button on a day dense enough to nearly fill the viewport — no
// amount of trailing padding on the list fixes this, since padding placed after content
// doesn't move that content when the page never actually needs to scroll. Instead we
// track #agenda-list-end (rendered as the last child of .agenda-day-groups, sitting
// exactly at the bottom of the real content, before the reserved trailing padding) and
// fade the FAB out whenever that point falls inside the FAB's own footprint — i.e.
// exactly when it would otherwise sit on top of the last card, whether that's because
// the page is short or because the user scrolled all the way down.
export function AgendaFab() {
  const [nearListEnd, setNearListEnd] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('agenda-list-end');
    if (!sentinel) return;

    function update() {
      const top = sentinel!.getBoundingClientRect().top;
      const fabTop = window.innerHeight - FAB_TOP_OFFSET_PX;
      setNearListEnd(top < window.innerHeight && top > fabTop - FAB_DANGER_BUFFER_PX);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <Link
      href="/dashboard/agenda/nova"
      className="agenda-fab"
      aria-label="Nova marcação"
      data-near-list-end={nearListEnd || undefined}
    >
      <Plus size={24} aria-hidden="true" />
    </Link>
  );
}

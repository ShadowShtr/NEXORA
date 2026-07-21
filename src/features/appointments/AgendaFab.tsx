'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useFabHidesNearListEnd } from '@/lib/useFabHidesNearListEnd';

// FAB's own footprint (globals.css .agenda-fab): 56px tall, bottom: 92px + safe-area.
const FAB_FOOTPRINT_PX = 92 + 56;

export function AgendaFab() {
  const nearListEnd = useFabHidesNearListEnd('agenda-list-end', FAB_FOOTPRINT_PX);

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

'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useFabHidesNearListEnd } from '@/lib/useFabHidesNearListEnd';

// FAB's own footprint (globals.css .clients-fab): 58px tall, bottom: 92px + safe-area.
const FAB_FOOTPRINT_PX = 92 + 58;

// There is no dedicated "criar cliente" form in this app yet — clients are only ever
// created inline through create_manual_booking (the "nova marcação" flow), same as the
// dashboard's own "Nova marcação" shortcut (src/app/(dashboard)/dashboard/page.tsx).
// Linking anywhere else here would be a fabricated destination.
export function ClientsFab() {
  const nearListEnd = useFabHidesNearListEnd('clients-list-end', FAB_FOOTPRINT_PX);

  return (
    <Link
      href="/dashboard/agenda/nova"
      className="clients-fab"
      aria-label="Nova marcação"
      data-near-list-end={nearListEnd || undefined}
    >
      <Plus size={28} aria-hidden="true" />
    </Link>
  );
}

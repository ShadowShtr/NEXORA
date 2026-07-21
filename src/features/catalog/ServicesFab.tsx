'use client';

import { Plus } from 'lucide-react';
import { useFabHidesNearListEnd } from '@/lib/useFabHidesNearListEnd';
import { useOpenCatalogSheet } from './CatalogSheetContext';
import type { CategoryFilter } from './CategoryChips';

// FAB's own footprint (globals.css .services-fab): 56px tall, bottom: 90px + safe-area.
const FAB_FOOTPRINT_PX = 90 + 56;

export function ServicesFab({ activeFilter }: { activeFilter: CategoryFilter }) {
  const openSheet = useOpenCatalogSheet();
  const nearListEnd = useFabHidesNearListEnd('services-list-end', FAB_FOOTPRINT_PX);

  return (
    <button
      type="button"
      className="services-fab"
      aria-label={activeFilter === 'packages' ? 'Novo pacote' : 'Novo serviço'}
      data-near-list-end={nearListEnd || undefined}
      onClick={() =>
        openSheet(
          activeFilter === 'packages'
            ? { type: 'package', pkg: null }
            : { type: 'service', service: null },
        )
      }
    >
      <Plus size={26} aria-hidden="true" />
    </button>
  );
}

'use client';

import { Plus } from 'lucide-react';
import { useOpenCatalogSheet } from './CatalogSheetContext';

// A service can't exist without a category (services.category_id is NOT NULL) — the
// "no services yet" empty state's "Criar serviço" opens ServiceEditorSheet with a
// required, empty <select>, an unusable dead end for a brand new tenant. This opens
// the categories sheet instead, the one place that actually creates the prerequisite.
export function ManageCategoriesButton({ label }: { label: string }) {
  const openSheet = useOpenCatalogSheet();

  return (
    <button
      type="button"
      className="new-service-button"
      onClick={() => openSheet({ type: 'categories' })}
    >
      <Plus aria-hidden="true" />
      {label}
    </button>
  );
}

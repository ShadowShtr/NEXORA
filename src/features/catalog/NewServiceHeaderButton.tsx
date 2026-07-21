'use client';

import { Plus } from 'lucide-react';
import { useOpenCatalogSheet } from './CatalogSheetContext';

export function NewServiceHeaderButton({
  label = 'Novo serviço',
  asPackage = false,
}: {
  label?: string;
  asPackage?: boolean;
}) {
  const openSheet = useOpenCatalogSheet();

  return (
    <button
      type="button"
      className={asPackage ? 'button' : 'new-service-button'}
      onClick={() =>
        openSheet(asPackage ? { type: 'package', pkg: null } : { type: 'service', service: null })
      }
    >
      <Plus aria-hidden="true" />
      {label}
    </button>
  );
}

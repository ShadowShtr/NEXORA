'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CategoryListItem } from './domain/category';
import type { ServiceListItem } from './domain/service';
import type { PackageListItem } from './domain/package';
import { ServiceEditorSheet } from './ServiceEditorSheet';
import { PackageEditorSheet } from './PackageEditorSheet';
import { CategoryManagementSheet } from './CategoryManagementSheet';

export type CatalogSheetTarget =
  | { type: 'service'; service: ServiceListItem | null }
  | { type: 'package'; pkg: PackageListItem | null }
  | { type: 'categories' };

const CatalogSheetOpenContext = createContext<((target: CatalogSheetTarget) => void) | null>(null);

// Visual refinement mid-2026 — Serviços reference: "a lista serve para consultar e
// gerir rapidamente; os formulários pertencem a telas separadas." One shared sheet
// slot per sheet type (not one per row) so the main list never grows a row's height to
// show a form — same architecture as AgendaCompletionContext for the agenda's
// completion sheet.
export function useOpenCatalogSheet() {
  const openSheet = useContext(CatalogSheetOpenContext);
  if (!openSheet) {
    throw new Error('useOpenCatalogSheet must be used within a CatalogSheetProvider');
  }
  return openSheet;
}

export function CatalogSheetProvider({
  categories,
  services,
  children,
}: {
  categories: CategoryListItem[];
  services: ServiceListItem[];
  children: ReactNode;
}) {
  const [target, setTarget] = useState<CatalogSheetTarget | null>(null);
  const close = () => setTarget(null);

  return (
    <CatalogSheetOpenContext.Provider value={setTarget}>
      {children}

      {target?.type === 'service' ? (
        <ServiceEditorSheet
          key={target.service?.id ?? 'new'}
          service={target.service}
          categories={categories}
          onClose={close}
        />
      ) : null}

      {target?.type === 'package' ? (
        <PackageEditorSheet
          key={target.pkg?.id ?? 'new'}
          pkg={target.pkg}
          services={services}
          onClose={close}
        />
      ) : null}

      {target?.type === 'categories' ? (
        <CategoryManagementSheet categories={categories} onClose={close} />
      ) : null}
    </CatalogSheetOpenContext.Provider>
  );
}

'use client';

import { Settings2 } from 'lucide-react';
import { useOpenCatalogSheet } from './CatalogSheetContext';
import type { CategoryListItem } from './domain/category';

export type CategoryFilter = 'all' | 'packages' | string;

function chipHref(query: string, filter: CategoryFilter): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (filter !== 'all') params.set('category', filter);
  const queryString = params.toString();
  return `/dashboard/servicos${queryString ? `?${queryString}` : ''}`;
}

export function CategoryChips({
  categories,
  activeFilter,
  query,
}: {
  categories: CategoryListItem[];
  activeFilter: CategoryFilter;
  query: string;
}) {
  const openSheet = useOpenCatalogSheet();
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="services-category-row">
      <div className="service-category-list">
        <a
          href={chipHref(query, 'all')}
          className="service-category-chip"
          data-active={activeFilter === 'all' || undefined}
        >
          Todos
        </a>
        {ordered.map((category) => (
          <a
            key={category.id}
            href={chipHref(query, category.id)}
            className="service-category-chip"
            data-active={activeFilter === category.id || undefined}
          >
            {category.name}
          </a>
        ))}
        <a
          href={chipHref(query, 'packages')}
          className="service-category-chip"
          data-active={activeFilter === 'packages' || undefined}
        >
          Pacotes
        </a>
      </div>
      <button
        type="button"
        className="manage-categories-button"
        onClick={() => openSheet({ type: 'categories' })}
      >
        <Settings2 aria-hidden="true" size={16} />
        Gerir
      </button>
    </div>
  );
}

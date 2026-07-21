import { SlidersHorizontal } from 'lucide-react';
import type { CategoryFilter } from './CategoryChips';

function href(query: string, category: CategoryFilter, nextOnlyActive: boolean): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category !== 'all') params.set('category', category);
  if (nextOnlyActive) params.set('onlyActive', '1');
  const queryString = params.toString();
  return `/dashboard/servicos${queryString ? `?${queryString}` : ''}`;
}

// A real, functional filter (show only active services/pacotes) rather than a
// decorative icon button with nothing behind it — the category chips already cover
// "which category," so this is the one other filter criterion that's genuinely useful
// and cheap to wire up honestly.
export function OnlyActiveFilterButton({
  active,
  query,
  category,
}: {
  active: boolean;
  query: string;
  category: CategoryFilter;
}) {
  return (
    <a
      href={href(query, category, !active)}
      className="services-filter-button"
      data-active={active || undefined}
      aria-label={
        active ? 'A mostrar apenas ativos — tocar para mostrar todos' : 'Mostrar apenas ativos'
      }
      title={active ? 'A mostrar apenas ativos' : 'Mostrar apenas ativos'}
    >
      <SlidersHorizontal aria-hidden="true" size={19} />
    </a>
  );
}

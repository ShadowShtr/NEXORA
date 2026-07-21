'use client';

import { useActionState, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight, Scissors } from 'lucide-react';
import { toggleServiceActive } from './actions';
import { useOpenCatalogSheet } from './CatalogSheetContext';
import type { ServiceListItem } from './domain/service';
import type { CategoryListItem } from './domain/category';
import type { Result } from '@/lib/result';

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// Visual refinement mid-2026 — Serviços reference: tapping the card opens the full
// editor in a shared sheet (CatalogSheetContext) instead of expanding a form inline —
// same "one shared sheet, not one form per row" architecture as the agenda completion
// sheet and the Clientes page. The active toggle is a separate sibling button (not
// nested inside the "open editor" button — a <button> can't validly contain another
// focusable element), same pattern AppointmentCard.tsx already uses for its own
// per-row action button.
export function ServiceCard({
  service,
  category,
  style,
}: {
  service: ServiceListItem;
  category: CategoryListItem | undefined;
  style?: CSSProperties;
}) {
  const openSheet = useOpenCatalogSheet();
  const [isActive, setIsActive] = useState(service.isActive);
  const [, toggleFormAction, togglePending] = useActionState<Result<null> | null, FormData>(
    toggleServiceActive,
    null,
  );

  function openEditor() {
    openSheet({ type: 'service', service });
  }

  return (
    <li className="service-card-item" style={style}>
      <div className="service-card">
        <button type="button" className="service-card-open" onClick={openEditor}>
          {service.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.photoUrl} alt="" className="service-card-image" />
          ) : (
            <span className="service-card-image service-card-image-fallback" aria-hidden="true">
              <Scissors size={26} />
            </span>
          )}

          <span className="service-card-main">
            <span className="service-card-name">{service.name}</span>
            <span className="service-card-meta">
              {service.durationMinutes} min{category ? ` · ${category.name}` : ''}
            </span>
            <span className="service-card-price">{formatEuros(service.priceCents)}</span>
          </span>
        </button>

        <button
          type="button"
          className="service-toggle"
          data-active={isActive || undefined}
          role="switch"
          aria-checked={isActive}
          aria-label={isActive ? `Desativar ${service.name}` : `Ativar ${service.name}`}
          disabled={togglePending}
          onClick={() => {
            setIsActive((current) => !current);
            const formData = new FormData();
            formData.set('id', service.id);
            toggleFormAction(formData);
          }}
        />

        <button
          type="button"
          className="service-card-chevron"
          onClick={openEditor}
          aria-label={`Ver detalhes de ${service.name}`}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

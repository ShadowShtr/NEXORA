'use client';

import { useActionState, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight, Gift } from 'lucide-react';
import { togglePackageActive } from './actions';
import { useOpenCatalogSheet } from './CatalogSheetContext';
import {
  derivePackageDurationMinutes,
  packageDiscountPercent,
  type PackageListItem,
} from './domain/package';
import type { ServiceListItem } from './domain/service';
import type { Result } from '@/lib/result';

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

export function PackageCard({
  pkg,
  servicesById,
  style,
}: {
  pkg: PackageListItem;
  servicesById: Map<string, ServiceListItem>;
  style?: CSSProperties;
}) {
  const openSheet = useOpenCatalogSheet();
  const [isActive, setIsActive] = useState(pkg.isActive);
  const [, toggleFormAction, togglePending] = useActionState<Result<null> | null, FormData>(
    togglePackageActive,
    null,
  );

  const durationMinutes = derivePackageDurationMinutes(pkg.serviceIds, servicesById);
  const discountPercent = packageDiscountPercent(pkg.priceCents, pkg.compareAtPriceCents);
  const includedNames = pkg.serviceIds
    .map((id) => servicesById.get(id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(' + ');

  function openEditor() {
    openSheet({ type: 'package', pkg });
  }

  return (
    <li className="service-card-item">
      <div className="package-card" style={style}>
        <button type="button" className="package-card-open" onClick={openEditor}>
          <span className="package-card-icon" aria-hidden="true">
            <Gift size={22} />
          </span>
          <span className="package-card-main">
            <span className="service-card-name">{pkg.name}</span>
            {includedNames ? <span className="service-card-meta">{includedNames}</span> : null}
            <span className="service-card-meta">{durationMinutes} min</span>
            <span className="package-card-price-row">
              <span className="service-card-price">{formatEuros(pkg.priceCents)}</span>
              {discountPercent !== null && pkg.compareAtPriceCents !== null ? (
                <>
                  <span className="package-card-compare-price">
                    {formatEuros(pkg.compareAtPriceCents)}
                  </span>
                  <span className="package-card-discount">-{discountPercent}%</span>
                </>
              ) : null}
            </span>
            {!isActive ? (
              <span className="text-support service-card-inactive-note">
                Inativo — não é oferecido
              </span>
            ) : null}
          </span>
        </button>

        <button
          type="button"
          className="service-toggle"
          data-active={isActive || undefined}
          role="switch"
          aria-checked={isActive}
          aria-label={isActive ? `Desativar ${pkg.name}` : `Ativar ${pkg.name}`}
          disabled={togglePending}
          onClick={() => {
            setIsActive((current) => !current);
            const formData = new FormData();
            formData.set('id', pkg.id);
            toggleFormAction(formData);
          }}
        />

        <button
          type="button"
          className="service-card-chevron"
          onClick={openEditor}
          aria-label={`Ver detalhes de ${pkg.name}`}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

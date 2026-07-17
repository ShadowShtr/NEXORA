'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';

type CartLine = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
};

type CategoryGroup = {
  id: string;
  name: string;
  services: CartLine[];
};

type PackageOption = CartLine & { itemNames: string };

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// No booking engine exists yet (that's a future epic) — "confirmar" hands off to
// WhatsApp with the selection already itemized, instead of pretending to book a real
// appointment slot the product can't actually reserve.
function buildWhatsappHref(
  phoneE164: string,
  businessName: string,
  lines: CartLine[],
  totalCents: number,
  totalMinutes: number,
) {
  const digits = phoneE164.replace('+', '');
  const intro = `Olá! Vim através da página de ${businessName}`;
  const text =
    lines.length === 0
      ? `${intro} e gostava de marcar.`
      : `${intro} e gostava de marcar:\n${lines.map((line) => `• ${line.name}`).join('\n')}\n\nTotal estimado: ${formatEuros(totalCents)} (~${totalMinutes} min)`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function PublicBookingCart({
  businessName,
  phoneE164,
  categoryGroups,
  packages,
}: {
  businessName: string;
  phoneE164: string | null;
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allLines = useMemo(() => {
    const map = new Map<string, CartLine>();
    for (const group of categoryGroups) {
      for (const service of group.services) map.set(service.id, service);
    }
    for (const pkg of packages) map.set(pkg.id, pkg);
    return map;
  }, [categoryGroups, packages]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLines = Array.from(selectedIds)
    .map((id) => allLines.get(id))
    .filter((line): line is CartLine => line !== undefined);
  const totalCents = selectedLines.reduce((sum, line) => sum + line.priceCents, 0);
  const totalMinutes = selectedLines.reduce((sum, line) => sum + line.durationMinutes, 0);
  const whatsappHref = phoneE164
    ? buildWhatsappHref(phoneE164, businessName, selectedLines, totalCents, totalMinutes)
    : null;

  return (
    <>
      <p className="public-step-label">Passo 1 · Escolha o que quer marcar</p>

      {categoryGroups.map((group) => (
        <Card key={group.id}>
          <h2>{group.name}</h2>
          <ul className="public-service-list">
            {group.services.map((service) => (
              <li key={service.id} className="public-service-item">
                <label className="public-service-choice">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(service.id)}
                    onChange={() => toggle(service.id)}
                  />
                  {service.name}
                </label>
                <span className="public-service-meta">
                  {service.durationMinutes} min · {formatEuros(service.priceCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {packages.length > 0 ? (
        <Card>
          <h2>Pacotes</h2>
          <ul className="public-service-list">
            {packages.map((pkg) => (
              <li key={pkg.id} className="public-service-item">
                <label className="public-service-choice">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(pkg.id)}
                    onChange={() => toggle(pkg.id)}
                  />
                  <span>
                    {pkg.name}
                    <br />
                    <small className="public-service-meta">{pkg.itemNames}</small>
                  </span>
                </label>
                <span className="public-service-meta">
                  {pkg.durationMinutes} min · {formatEuros(pkg.priceCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="public-summary">
        <p className="public-step-label">Passo 2 · Confirmar</p>
        {selectedLines.length === 0 ? (
          <p>Escolha pelo menos um serviço ou pacote acima.</p>
        ) : (
          <ul className="public-service-list">
            {selectedLines.map((line) => (
              <li key={line.id} className="public-service-item">
                <span>{line.name}</span>
                <span className="public-service-meta">{formatEuros(line.priceCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="public-summary-total">
          Total: {formatEuros(totalCents)} · {totalMinutes} min
        </p>
        {whatsappHref ? (
          <a
            className="button link-button"
            href={whatsappHref}
            aria-disabled={selectedLines.length === 0}
          >
            Confirmar por WhatsApp
          </a>
        ) : null}
      </Card>
    </>
  );
}

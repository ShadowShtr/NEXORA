'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  addToCart,
  cartTotals,
  removeFromCart,
  type CartItem,
} from '@/features/catalog/domain/package-cart';
import type { ServiceListItem } from '@/features/catalog/domain/service';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function toCartItem(service: ServiceListItem): CartItem {
  return {
    serviceId: service.id,
    name: service.name,
    priceCents: service.priceCents,
    durationMinutes: service.durationMinutes,
  };
}

export function PackageCart({
  services,
  initialServiceIds,
}: {
  services: ServiceListItem[];
  initialServiceIds: string[];
}) {
  const [cart, setCart] = useState<CartItem[]>(() =>
    initialServiceIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is ServiceListItem => Boolean(service))
      .map(toCartItem),
  );
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const availableServices = services.filter(
    (service) => !cart.some((item) => item.serviceId === service.id),
  );
  const totals = cartTotals(cart);

  function handleAdd() {
    const service = services.find((candidate) => candidate.id === selectedServiceId);
    if (!service) return;

    const result = addToCart(cart, toCartItem(service));
    if (result.blocked) {
      setBlockedMessage(`${service.name} já foi adicionado.`);
      return;
    }
    setBlockedMessage(null);
    setCart(result.cart);
    setSelectedServiceId('');
  }

  function handleRemove(serviceId: string) {
    setCart(removeFromCart(cart, serviceId));
    setBlockedMessage(null);
  }

  return (
    <fieldset className="catalog-package-items">
      <legend>Serviços incluídos</legend>

      {cart.length === 0 ? (
        <p>Ainda não adicionou nenhum serviço.</p>
      ) : (
        <ul className="catalog-cart-list">
          {cart.map((item) => (
            <li key={item.serviceId} className="catalog-cart-item">
              <input type="hidden" name="serviceIds" value={item.serviceId} />
              <span>
                {item.name} · {item.durationMinutes} min
              </span>
              <Button type="button" onClick={() => handleRemove(item.serviceId)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="catalog-cart-total">
        Duração total: {totals.durationMinutes} min · Soma dos preços dos serviços:{' '}
        {formatEuros(totals.priceCents)}
      </p>

      {availableServices.length > 0 ? (
        <div className="catalog-cart-add">
          <select
            value={selectedServiceId}
            onChange={(event) => setSelectedServiceId(event.target.value)}
            aria-label="Escolher serviço para adicionar"
          >
            <option value="">Escolher serviço…</option>
            {availableServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.durationMinutes} min
              </option>
            ))}
          </select>
          <Button type="button" onClick={handleAdd} disabled={!selectedServiceId}>
            Adicionar
          </Button>
        </div>
      ) : null}

      {blockedMessage ? (
        <p role="alert" className="form-error">
          {blockedMessage}
        </p>
      ) : null}
    </fieldset>
  );
}

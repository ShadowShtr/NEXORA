'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/Button';
import { createManualBooking } from './manual-booking-actions';
import { getManualBookingAvailability } from './manual-availability-actions';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  type PackageOption,
  type ServiceLine,
} from '@/app/b/[slug]/domain/booking-selection';
import type { Result } from '@/lib/result';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

type ClientOption = { id: string; name: string; phoneE164: string };
type CategoryGroup = { id: string; name: string; services: ServiceLine[] };

// NEX-085/092: "Cliente, itens, slot, valor, observação" with "sugestão/dedup" of an
// existing client — a <select> populated from the owner's own client list (NEX-090's
// eventual search UI is a superset of this; this task only needs the ability to pick
// one instead of always re-typing contact details) plus a "novo cliente" fallback.
export function ManualBookingForm({
  clients,
  categoryGroups,
  packages,
  timezone,
}: {
  clients: ClientOption[];
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
  timezone: string;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    createManualBooking,
    null,
  );

  const [clientMode, setClientMode] = useState<'existing' | 'new'>(
    clients.length > 0 ? 'existing' : 'new',
  );
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const servicesById = useMemo(() => {
    const map = new Map<string, ServiceLine>();
    for (const group of categoryGroups) {
      for (const service of group.services) map.set(service.id, service);
    }
    return map;
  }, [categoryGroups]);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;
  const coveredByPackage = new Set(selectedPackage?.serviceIds ?? []);

  function toggleService(id: string) {
    if (coveredByPackage.has(id)) return;
    setSelectedServiceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectPackage(pkg: PackageOption | null) {
    setSelectedPackageId(pkg?.id ?? null);
    setSelectedServiceIds((current) => new Set(dropServicesCoveredByPackage([...current], pkg)));
  }

  const lines = cartLines(
    { selectedPackageId, selectedServiceIds: Array.from(selectedServiceIds) },
    servicesById,
    packages,
  );
  const { totalCents, totalMinutes } = cartTotals(lines);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      setSelectedSlotIso(null);
      if (totalMinutes <= 0) {
        setSlots(null);
        return;
      }
      setSlots(null);
      setSlotsError(null);

      const result = await getManualBookingAvailability(totalMinutes);
      if (cancelled) return;
      if (!result.ok) {
        setSlotsError('Não foi possível carregar os horários disponíveis.');
        return;
      }
      setSlots(result.value.slotsIso);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [totalMinutes]);

  return (
    <form action={formAction} className="stack">
      <fieldset>
        <legend>Cliente</legend>
        {clients.length > 0 ? (
          <div className="stack">
            <label>
              <input
                type="radio"
                name="clientMode"
                checked={clientMode === 'existing'}
                onChange={() => setClientMode('existing')}
              />
              Cliente existente
            </label>
            {clientMode === 'existing' ? (
              <select
                name="clientId"
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                aria-label="Escolher cliente"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.phoneE164}
                  </option>
                ))}
              </select>
            ) : null}
            <label>
              <input
                type="radio"
                name="clientMode"
                checked={clientMode === 'new'}
                onChange={() => setClientMode('new')}
              />
              Nova cliente
            </label>
          </div>
        ) : (
          <input type="hidden" name="clientId" value="" />
        )}

        {clientMode === 'new' ? (
          <div className="stack">
            <label>
              Nome
              <input name="clientName" required maxLength={120} />
            </label>
            <label>
              Telemóvel
              <input name="clientPhone" type="tel" required />
            </label>
            <label>
              E-mail (opcional)
              <input name="clientEmail" type="text" inputMode="email" />
            </label>
          </div>
        ) : (
          <input type="hidden" name="clientId" value={selectedClientId} />
        )}
      </fieldset>

      <fieldset>
        <legend>Serviços</legend>
        {categoryGroups.map((group) => (
          <div key={group.id}>
            <p className="public-step-label">{group.name}</p>
            <ul className="public-service-list">
              {group.services.map((service) => {
                const included = coveredByPackage.has(service.id);
                return (
                  <li key={service.id} className="public-service-item">
                    <label className="public-service-choice">
                      <input
                        type="checkbox"
                        name="selectedServiceIds"
                        value={service.id}
                        checked={included || selectedServiceIds.has(service.id)}
                        disabled={included}
                        onChange={() => toggleService(service.id)}
                      />
                      {service.name}
                    </label>
                    <span className="public-service-meta">
                      {service.durationMinutes} min · {formatEuros(service.priceCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {packages.length > 0 ? (
          <div>
            <p className="public-step-label">Pacotes</p>
            <ul className="public-service-list">
              <li className="public-service-item">
                <label className="public-service-choice">
                  <input
                    type="radio"
                    name="packageChoice"
                    checked={selectedPackageId === null}
                    onChange={() => selectPackage(null)}
                  />
                  Nenhum pacote
                </label>
              </li>
              {packages.map((pkg) => (
                <li key={pkg.id} className="public-service-item">
                  <label className="public-service-choice">
                    <input
                      type="radio"
                      name="packageChoice"
                      checked={selectedPackageId === pkg.id}
                      onChange={() => selectPackage(pkg)}
                    />
                    {pkg.name}
                  </label>
                  <span className="public-service-meta">{formatEuros(pkg.priceCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {selectedPackageId ? (
          <input type="hidden" name="selectedPackageId" value={selectedPackageId} />
        ) : null}
      </fieldset>

      <p className="public-summary-total">
        Total: {formatEuros(totalCents)} · {totalMinutes} min
      </p>

      <fieldset>
        <legend>Horário</legend>
        {totalMinutes <= 0 ? (
          <p>Escolha pelo menos um serviço ou pacote.</p>
        ) : slotsError ? (
          <p role="alert" className="form-error">
            {slotsError}
          </p>
        ) : slots === null ? (
          <p aria-live="polite">A carregar horários…</p>
        ) : slots.length === 0 ? (
          <p>Sem horários disponíveis.</p>
        ) : (
          <ul className="public-slot-list">
            {slots.slice(0, 60).map((iso) => (
              <li key={iso}>
                <button
                  type="button"
                  className="public-slot-button"
                  aria-pressed={selectedSlotIso === iso}
                  onClick={() => setSelectedSlotIso(iso)}
                >
                  {formatInTimeZone(iso, timezone, 'dd/MM HH:mm')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" name="startAtIso" value={selectedSlotIso ?? ''} />
      </fieldset>

      <label>
        Observação (opcional)
        <textarea name="observation" maxLength={2000} rows={3} />
      </label>

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !selectedSlotIso || lines.length === 0}>
        {pending ? 'A criar…' : 'Criar marcação'}
      </Button>
    </form>
  );
}

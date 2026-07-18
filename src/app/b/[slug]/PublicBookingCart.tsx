'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PreRegistrationStep } from './PreRegistrationStep';
import { SlotPicker } from './SlotPicker';
import { BookingConfirmation } from './BookingConfirmation';
import { resumeBookingDraft, saveBookingDraft } from './draft-actions';
import { createPublicBooking } from './booking-actions';
import { generateIdempotencyKey } from './domain/idempotency-key';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  itemCountLabel,
  type PackageOption,
  type ServiceLine,
} from './domain/booking-selection';
import type { ClientContactInput } from '@/lib/validation/client';

type CategoryGroup = {
  id: string;
  name: string;
  services: ServiceLine[];
};

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// No booking engine exists yet (that's a future epic) — "confirmar" hands off to
// WhatsApp with the selection already itemized, instead of pretending to book a real
// appointment slot the product can't actually reserve.
function buildWhatsappHref(
  phoneE164: string,
  businessName: string,
  clientName: string,
  lines: ServiceLine[],
  totalCents: number,
  totalMinutes: number,
) {
  const digits = phoneE164.replace('+', '');
  const intro = `Olá! Chamo-me ${clientName} e vim através da página de ${businessName}`;
  const text =
    lines.length === 0
      ? `${intro} e gostava de marcar.`
      : `${intro} e gostava de marcar:\n${lines.map((line) => `• ${line.name}`).join('\n')}\n\nTotal estimado: ${formatEuros(totalCents)} (~${totalMinutes} min)`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Same-device recovery only (NEX-052): the resume token lives in this browser's
// localStorage, scoped per tenant — no e-mail delivery involved.
function draftStorageKey(tenantSlug: string) {
  return `nexora-draft-${tenantSlug}`;
}

export function PublicBookingCart({
  tenantId,
  tenantSlug,
  businessName,
  phoneE164,
  timezone,
  locationUrl,
  categoryGroups,
  packages,
}: {
  tenantId: string;
  tenantSlug: string;
  businessName: string;
  phoneE164: string | null;
  timezone: string;
  locationUrl: string | null;
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
}) {
  const [registration, setRegistration] = useState<ClientContactInput | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [resumeChecked, setResumeChecked] = useState(false);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slotReloadKey, setSlotReloadKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ bookingToken: string } | null>(null);

  // Attempt a same-device resume once, on mount. setState only ever happens inside
  // this nested async function (never directly in the effect body), and only if the
  // effect hasn't been cleaned up in the meantime.
  useEffect(() => {
    let cancelled = false;

    async function checkForDraft() {
      const key = draftStorageKey(tenantSlug);
      const token = window.localStorage.getItem(key);
      if (!token) {
        if (!cancelled) setResumeChecked(true);
        return;
      }

      const result = await resumeBookingDraft(token);
      if (cancelled) return;
      if (result.ok) {
        setRegistration(result.value.registration);
        setSelectedPackageId(result.value.selectedPackageId);
        setSelectedServiceIds(new Set(result.value.selectedServiceIds));
      } else {
        window.localStorage.removeItem(key);
      }
      setResumeChecked(true);
    }

    void checkForDraft();
    return () => {
      cancelled = true;
    };
    // Only ever run once, right after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save (debounced) whenever the registration or selection changes, so the client can
  // recover on this device even if they close the tab mid-selection. Reuses whatever
  // token is already in localStorage so repeated edits update one row instead of
  // creating a new one each time (see saveBookingDraft's existingToken parameter).
  useEffect(() => {
    if (!registration) return;

    async function persistDraft() {
      const key = draftStorageKey(tenantSlug);
      const result = await saveBookingDraft(tenantId, window.localStorage.getItem(key), {
        registration: registration!,
        selectedPackageId,
        selectedServiceIds: Array.from(selectedServiceIds),
      });
      if (result.ok) {
        window.localStorage.setItem(key, result.value.resumeToken);
      }
    }

    const timeout = setTimeout(() => void persistDraft(), 600);
    return () => clearTimeout(timeout);
  }, [registration, selectedPackageId, selectedServiceIds, tenantId, tenantSlug]);

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

  // Choosing a package drops any already-checked "extra" that the package now covers —
  // otherwise its checkbox would look checked-but-disabled, implying it still adds to
  // the total when it no longer does (PRD: "sem duplicação de itens já incluídos").
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
  const whatsappHref =
    phoneE164 && registration
      ? buildWhatsappHref(
          phoneE164,
          businessName,
          registration.name,
          lines,
          totalCents,
          totalMinutes,
        )
      : null;

  // A cart change invalidates whatever slot/attempt was in progress — the previously
  // computed slots were sized for a different total duration, and retrying a stale
  // idempotency key against a new payload would only ever hit IDEMPOTENCY_CONFLICT.
  function handleSelectSlot(iso: string) {
    setSelectedSlotIso(iso);
    setIdempotencyKey(generateIdempotencyKey());
    setBookingError(null);
  }

  async function handleConfirmBooking() {
    if (!registration || !selectedSlotIso || !idempotencyKey) return;
    setIsBooking(true);
    setBookingError(null);

    const result = await createPublicBooking({
      tenantId,
      registration,
      selectedServiceIds: Array.from(selectedServiceIds),
      selectedPackageId,
      startAtIso: selectedSlotIso,
      idempotencyKey,
    });

    setIsBooking(false);

    if (!result.ok) {
      if (result.error.code === 'SLOT_TAKEN') {
        // Mensagem clara, refresh de slots e carrinho preservado (NEX-065 acceptance
        // criteria): the cart selection is untouched, only the slot choice and the
        // attempt's idempotency key reset, and SlotPicker is told to refetch via
        // slotReloadKey — the just-taken slot won't be offered again.
        setBookingError('Este horário acabou de ser reservado por outra pessoa. Escolha outro.');
        setSelectedSlotIso(null);
        setIdempotencyKey(null);
        setSlotReloadKey((key) => key + 1);
        return;
      }
      setBookingError(result.error.message);
      return;
    }

    if (window.localStorage) {
      window.localStorage.removeItem(draftStorageKey(tenantSlug));
    }
    // bookingToken is only ever null on an idempotent replay (create_public_booking,
    // NEX-064) — unreachable here since a fresh idempotencyKey is minted on every slot
    // selection (handleSelectSlot), so this attempt can never collide with a prior one.
    if (result.value.bookingToken) {
      setConfirmedBooking({ bookingToken: result.value.bookingToken });
    }
  }

  if (!resumeChecked) return null;

  if (!registration) {
    return <PreRegistrationStep onComplete={setRegistration} />;
  }

  if (confirmedBooking) {
    return (
      <BookingConfirmation bookingToken={confirmedBooking.bookingToken} locationUrl={locationUrl} />
    );
  }

  return (
    <>
      <div className="public-booking-content">
        <div className="public-registration-summary">
          <span>
            {registration.name} · {registration.phone}
          </span>
          <Button type="button" variant="secondary" onClick={() => setRegistration(null)}>
            Alterar dados
          </Button>
        </div>
        <p className="public-step-label">Passo 2 · Escolha o que quer marcar</p>

        {categoryGroups.map((group) => (
          <Card key={group.id}>
            <h2>{group.name}</h2>
            <ul className="public-service-list">
              {group.services.map((service) => {
                const included = coveredByPackage.has(service.id);
                return (
                  <li key={service.id} className="public-service-item">
                    <label className="public-service-choice">
                      <input
                        type="checkbox"
                        checked={included || selectedServiceIds.has(service.id)}
                        disabled={included}
                        onChange={() => toggleService(service.id)}
                      />
                      {service.name}
                      {included ? (
                        <span className="public-service-included"> · Incluído no pacote</span>
                      ) : null}
                    </label>
                    <span className="public-service-meta">
                      {service.durationMinutes} min · {formatEuros(service.priceCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}

        {packages.length > 0 ? (
          <Card>
            <fieldset className="public-package-fieldset">
              <legend>Pacotes</legend>
              <ul className="public-service-list">
                <li className="public-service-item">
                  <label className="public-service-choice">
                    <input
                      type="radio"
                      name="pacote"
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
                        name="pacote"
                        checked={selectedPackageId === pkg.id}
                        onChange={() => selectPackage(pkg)}
                      />
                      <span className="public-package-name">
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
            </fieldset>
            <p className="public-service-meta">
              Escolheu um pacote? Os serviços já incluídos ficam marcados acima — pode ainda
              adicionar outros serviços como extras.
            </p>
          </Card>
        ) : null}

        <Card className="public-summary">
          <p className="public-step-label">Resumo</p>
          {lines.length === 0 ? (
            <p>Escolha pelo menos um serviço ou pacote acima.</p>
          ) : (
            <ul className="public-service-list">
              {lines.map((line) => (
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
        </Card>

        {lines.length > 0 ? (
          <SlotPicker
            tenantId={tenantId}
            timezone={timezone}
            totalMinutes={totalMinutes}
            selectedIso={selectedSlotIso}
            onSelect={handleSelectSlot}
            reloadKey={slotReloadKey}
          />
        ) : null}

        <Card className="public-summary" id="confirmar">
          <p className="public-step-label">Passo 4 · Confirmar</p>
          {bookingError ? (
            <p role="alert" className="form-error">
              {bookingError}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={lines.length === 0 || !selectedSlotIso || isBooking}
            onClick={() => void handleConfirmBooking()}
          >
            {isBooking ? 'A confirmar…' : 'Confirmar marcação'}
          </Button>
          {whatsappHref ? (
            <a className="button link-button" href={whatsappHref}>
              Prefere combinar por WhatsApp?
            </a>
          ) : null}
        </Card>
      </div>

      {/* PRD 01 §3.6: "Barra fixa mostra quantidade, duração e valor do carrinho" — kept
          visible while browsing services/pacotes, instead of only at the bottom of the
          page after scrolling past everything. */}
      <div className="public-cart-bar">
        <span className="public-cart-bar-summary" role="status">
          {itemCountLabel(lines.length)} · {totalMinutes} min · {formatEuros(totalCents)}
        </span>
        <Button
          type="button"
          disabled={lines.length === 0}
          onClick={() =>
            document
              .getElementById('confirmar')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Continuar
        </Button>
      </div>
    </>
  );
}

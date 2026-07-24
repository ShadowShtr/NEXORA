'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/Button';
import { createManualBooking } from './manual-booking-actions';
import { getManualBookingAvailability } from './manual-availability-actions';
import { createRecurringSeries } from './recurring-series-actions';
import { checkRecurrenceConflicts } from './recurrence-conflicts-actions';
import { generateRecurrenceOccurrences, type RecurrenceFrequency } from './domain/recurrence';
import {
  suggestExistingClients,
  type ClientSuggestion,
} from '@/features/clients/suggestion-actions';
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

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  custom: 'Intervalo personalizado',
};

// NEX-122: recurring_series.interval_value only carries meaning for frequency='custom'
// (see NEX-120's domain/recurrence.ts) — the four named frequencies are fully
// self-describing, so they're always stored as 1.
function intervalValueFor(frequency: RecurrenceFrequency, customIntervalDays: number): number {
  return frequency === 'custom' ? customIntervalDays : 1;
}

type OccurrenceReview = {
  originalIso: string;
  hasConflict: boolean;
  alternativesIso: string[];
  chosenIso: string;
  removed: boolean;
};

type ClientOption = { id: string; name: string; phoneE164: string };
type CategoryGroup = { id: string; name: string; services: ServiceLine[] };

// NEX-085/092: "Cliente, itens, slot, valor, observação" with "sugestão/dedup" of an
// existing client — a <select> populated from the owner's own client list (NEX-090's
// eventual search UI is a superset of this; this task only needs the ability to pick
// one instead of always re-typing contact details) plus a "novo cliente" fallback.
//
// NEX-122 extends this with an optional recurring series: enabling it swaps the submit
// button for "Rever ocorrências", which generates candidate dates (NEX-120) from the
// already-chosen first slot, checks them against real availability (NEX-121), and moves
// to a review step where the owner resolves any conflict (pick a suggested alternative
// or drop that occurrence) before a second, separate form actually creates the series
// (createRecurringSeries -> create_recurring_series, atomic — NEX-122's own migration).
export function ManualBookingForm({
  clients,
  categoryGroups,
  packages,
  timezone,
  initialClientId,
}: {
  clients: ClientOption[];
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
  timezone: string;
  initialClientId?: string | undefined;
}) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    createManualBooking,
    null,
  );
  const [seriesState, seriesFormAction, seriesPending] = useActionState<
    Result<null> | null,
    FormData
  >(createRecurringSeries, null);

  const preselectedClient =
    initialClientId && clients.some((client) => client.id === initialClientId)
      ? initialClientId
      : null;
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(
    clients.length > 0 ? 'existing' : 'new',
  );
  const [selectedClientId, setSelectedClientId] = useState(
    preselectedClient ?? clients[0]?.id ?? '',
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [observation, setObservation] = useState('');
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);

  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [occurrenceCount, setOccurrenceCount] = useState(4);
  const [customIntervalDays, setCustomIntervalDays] = useState(14);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsError, setConflictsError] = useState<string | null>(null);
  const [step, setStep] = useState<'compose' | 'review'>('compose');
  const [occurrenceReviews, setOccurrenceReviews] = useState<OccurrenceReview[] | null>(null);

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

  // NEX-092: "Busca sugere cliente existente por nome/telemóvel" — debounced so typing
  // doesn't fire a request per keystroke; only active in "nova cliente" mode, since an
  // already-selected existing client has nothing to suggest against.
  useEffect(() => {
    let cancelled = false;

    if (
      clientMode !== 'new' ||
      (newClientName.trim().length < 2 && newClientPhone.trim().length < 3)
    ) {
      const timeout = setTimeout(() => {
        if (!cancelled) setSuggestions([]);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }

    const timeout = setTimeout(() => {
      void (async () => {
        const result = await suggestExistingClients(newClientName, newClientPhone);
        if (cancelled) return;
        setSuggestions(result.ok ? result.value : []);
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [clientMode, newClientName, newClientPhone]);

  function applySuggestedClient(client: ClientSuggestion) {
    setClientMode('existing');
    setSelectedClientId(client.id);
    setSuggestions([]);
    setNewClientName('');
    setNewClientPhone('');
  }

  async function handlePreviewRecurrence() {
    if (!selectedSlotIso || lines.length === 0) return;
    setConflictsError(null);
    setConflictsLoading(true);

    try {
      const occurrencesMs = generateRecurrenceOccurrences({
        firstOccurrenceMs: new Date(selectedSlotIso).getTime(),
        timeZone: timezone,
        frequency,
        occurrenceCount,
        ...(frequency === 'custom' ? { customIntervalDays } : {}),
      });
      const occurrencesIso = occurrencesMs.map((ms) => new Date(ms).toISOString());

      const result = await checkRecurrenceConflicts(occurrencesIso, totalMinutes);
      if (!result.ok) {
        setConflictsError(result.error.message);
        return;
      }

      setOccurrenceReviews(
        result.value.checks.map((check) => ({
          originalIso: check.occurrenceIso,
          hasConflict: check.hasConflict,
          alternativesIso: [...check.alternativeSlotsIso],
          chosenIso: check.occurrenceIso,
          removed: false,
        })),
      );
      setStep('review');
    } catch {
      setConflictsError('Não foi possível gerar as ocorrências.');
    } finally {
      setConflictsLoading(false);
    }
  }

  function pickAlternative(originalIso: string, alternativeIso: string) {
    setOccurrenceReviews(
      (current) =>
        current?.map((occurrence) =>
          occurrence.originalIso === originalIso
            ? { ...occurrence, chosenIso: alternativeIso, removed: false }
            : occurrence,
        ) ?? null,
    );
  }

  function toggleRemoved(originalIso: string) {
    setOccurrenceReviews(
      (current) =>
        current?.map((occurrence) =>
          occurrence.originalIso === originalIso
            ? { ...occurrence, removed: !occurrence.removed }
            : occurrence,
        ) ?? null,
    );
  }

  if (step === 'review' && occurrenceReviews) {
    const remaining = occurrenceReviews.filter((occurrence) => !occurrence.removed);
    const hasUnresolvedConflict = remaining.some(
      (occurrence) => occurrence.hasConflict && occurrence.chosenIso === occurrence.originalIso,
    );
    const canConfirm = remaining.length >= 2 && !hasUnresolvedConflict;

    return (
      <form action={seriesFormAction} className="stack">
        {clientMode === 'existing' ? (
          <input type="hidden" name="clientId" value={selectedClientId} />
        ) : (
          <>
            <input type="hidden" name="clientId" value="" />
            <input type="hidden" name="clientName" value={newClientName} />
            <input type="hidden" name="clientPhone" value={newClientPhone} />
            <input type="hidden" name="clientEmail" value={newClientEmail} />
          </>
        )}
        {Array.from(selectedServiceIds).map((id) => (
          <input key={id} type="hidden" name="selectedServiceIds" value={id} />
        ))}
        {selectedPackageId ? (
          <input type="hidden" name="selectedPackageId" value={selectedPackageId} />
        ) : null}
        <input type="hidden" name="observation" value={observation} />
        <input type="hidden" name="frequency" value={frequency} />
        <input
          type="hidden"
          name="intervalValue"
          value={intervalValueFor(frequency, customIntervalDays)}
        />
        {remaining.map((occurrence) => (
          <input
            key={occurrence.originalIso}
            type="hidden"
            name="occurrencesIso"
            value={occurrence.chosenIso}
          />
        ))}

        <h2 className="text-subtitle">Rever ocorrências</h2>
        <p className="text-support">
          {FREQUENCY_LABELS[frequency]} · {remaining.length} de {occurrenceReviews.length} marcações
        </p>

        <ul className="stack">
          {occurrenceReviews.map((occurrence) => {
            const isResolvedConflict =
              occurrence.hasConflict && occurrence.chosenIso !== occurrence.originalIso;
            return (
              <li key={occurrence.originalIso} className="public-service-item stack">
                <div className="public-service-choice">
                  <span
                    className={occurrence.removed ? 'recurrence-occurrence-removed' : undefined}
                  >
                    {formatInTimeZone(occurrence.chosenIso, timezone, "EEEE, dd/MM 'às' HH:mm")}
                  </span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => toggleRemoved(occurrence.originalIso)}
                  >
                    {occurrence.removed ? 'Readicionar' : 'Remover'}
                  </button>
                </div>

                {!occurrence.removed && occurrence.hasConflict ? (
                  isResolvedConflict ? (
                    <p className="text-support">Substituída por horário livre acima.</p>
                  ) : (
                    <div className="stack">
                      <p role="alert" className="form-error">
                        Este horário já está ocupado.
                      </p>
                      {occurrence.alternativesIso.length > 0 ? (
                        <ul className="public-slot-list">
                          {occurrence.alternativesIso.map((alternativeIso) => (
                            <li key={alternativeIso}>
                              <button
                                type="button"
                                className="public-slot-button"
                                onClick={() =>
                                  pickAlternative(occurrence.originalIso, alternativeIso)
                                }
                              >
                                {formatInTimeZone(alternativeIso, timezone, 'dd/MM HH:mm')}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-support">Sem alternativas próximas disponíveis.</p>
                      )}
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>

        {remaining.length < 2 ? (
          <p role="alert" className="form-error">
            Uma série precisa de pelo menos 2 marcações.
          </p>
        ) : null}

        {seriesState && !seriesState.ok ? (
          <p role="alert" className="form-error">
            {seriesState.error.message}
          </p>
        ) : null}

        <div className="wizard-actions">
          <Button type="button" variant="secondary" onClick={() => setStep('compose')}>
            Voltar
          </Button>
          <Button type="submit" disabled={seriesPending || !canConfirm}>
            {seriesPending ? 'A criar…' : `Confirmar ${remaining.length} marcações`}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="stack">
      <fieldset>
        <legend className="text-subtitle">Cliente</legend>
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
              <input
                name="clientName"
                required
                maxLength={120}
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
              />
            </label>
            <label>
              Telemóvel
              <input
                name="clientPhone"
                type="tel"
                required
                value={newClientPhone}
                onChange={(event) => setNewClientPhone(event.target.value)}
              />
            </label>
            <label>
              E-mail (opcional)
              <input
                name="clientEmail"
                type="text"
                inputMode="email"
                value={newClientEmail}
                onChange={(event) => setNewClientEmail(event.target.value)}
              />
            </label>

            {suggestions.length > 0 ? (
              <div className="client-suggestions" role="status">
                <p className="text-support">Já existe uma cliente parecida:</p>
                <ul className="clients-list">
                  {suggestions.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        className="clients-list-link client-suggestion-button"
                        onClick={() => applySuggestedClient(client)}
                      >
                        <span className="clients-list-name">{client.name}</span>
                        <span className="clients-list-phone">{client.phoneE164}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <input type="hidden" name="clientId" value={selectedClientId} />
        )}
      </fieldset>

      <fieldset>
        <legend className="text-subtitle">Serviços</legend>
        {categoryGroups.map((group) => (
          <div key={group.id}>
            <p className="text-eyebrow">{group.name}</p>
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
            <p className="text-eyebrow">Pacotes</p>
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
        <legend className="text-subtitle">Horário</legend>
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

      <fieldset>
        <legend className="text-subtitle">Repetição</legend>
        <label>
          <input
            type="checkbox"
            checked={recurringEnabled}
            onChange={(event) => {
              setRecurringEnabled(event.target.checked);
              setConflictsError(null);
            }}
          />
          Marcação recorrente
        </label>

        {recurringEnabled ? (
          <div className="stack">
            <label>
              Frequência
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
              >
                {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((value) => (
                  <option key={value} value={value}>
                    {FREQUENCY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            {frequency === 'custom' ? (
              <label>
                Repetir a cada quantos dias
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={customIntervalDays}
                  onChange={(event) => setCustomIntervalDays(Number(event.target.value))}
                />
              </label>
            ) : null}

            <label>
              Número de marcações (incluindo a primeira)
              <input
                type="number"
                min={2}
                max={52}
                value={occurrenceCount}
                onChange={(event) => setOccurrenceCount(Number(event.target.value))}
              />
            </label>

            {conflictsError ? (
              <p role="alert" className="form-error">
                {conflictsError}
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <label>
        Observação (opcional)
        <textarea
          name="observation"
          maxLength={2000}
          rows={3}
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
        />
      </label>

      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}

      {recurringEnabled ? (
        <Button
          type="button"
          disabled={!selectedSlotIso || lines.length === 0 || conflictsLoading}
          onClick={() => void handlePreviewRecurrence()}
        >
          {conflictsLoading ? 'A verificar…' : 'Rever ocorrências'}
        </Button>
      ) : (
        <Button type="submit" disabled={pending || !selectedSlotIso || lines.length === 0}>
          {pending ? 'A criar…' : 'Criar marcação'}
        </Button>
      )}
    </form>
  );
}

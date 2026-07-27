'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { ArrowLeft } from 'lucide-react';
import { createManualBooking } from '../manual-booking-actions';
import { getManualBookingAvailability } from '../manual-availability-actions';
import { createRecurringSeries } from '../recurring-series-actions';
import { checkRecurrenceConflicts } from '../recurrence-conflicts-actions';
import { generateRecurrenceOccurrences, type RecurrenceFrequency } from '../domain/recurrence';
import {
  cartLines,
  cartTotals,
  dropServicesCoveredByPackage,
  type PackageOption,
  type ServiceLine,
} from '@/app/b/[slug]/domain/booking-selection';
import { capitalize } from '../domain/appointment-wizard';
import { ClientStep, type ClientSelection } from './ClientStep';
import { ServicesStep, type CategoryGroup } from './ServicesStep';
import { ScheduleStep } from './ScheduleStep';
import { RecurrenceReview, type OccurrenceReview } from './RecurrenceReview';
import { ConfirmStep } from './ConfirmStep';
import { SuccessScreen } from './SuccessScreen';
import { AppointmentSummaryPanel } from './AppointmentSummaryPanel';
import { WizardProgress } from './WizardProgress';
import { Button } from '@/components/ui/Button';

type MainStep = 'client' | 'services' | 'schedule' | 'confirm';
const MAIN_STEPS: MainStep[] = ['client', 'services', 'schedule', 'confirm'];

type SuccessState =
  | { kind: 'single'; appointmentId: string; dateTimeLabel: string }
  | { kind: 'series'; occurrenceCount: number; dateTimeLabel: string };

// Visual refinement mid-2026: replaces the old single-scroll ManualBookingForm (every
// field — cliente, serviços, horário, repetição, observação — visible and editable at
// once, fieldset/legend HTML-form styling) with a 4-step guided wizard: Cliente →
// Serviços → Data e horário → Confirmar, one decision at a time, matching the visual
// language already established for Agenda/Clientes/Serviços/Financeiro/Lembretes.
//
// The recurring-series conflict review (NEX-122) is not one of the 4 numbered steps —
// it only appears, between "Data e horário" and "Confirmar", when the owner turned
// recurrence on and asked to review the generated occurrences. Nothing about its own
// logic changed here, only its presentation (RecurrenceReview.tsx).
//
// Both mutating server actions (createManualBooking, createRecurringSeries) used to
// redirect() on success; they now return the created id instead, so this component can
// show its own success screen (client/date/total, "Ver marcação"/"Abrir WhatsApp"/
// "Criar outra") before the owner navigates away, rather than the old instant redirect.
export function NewAppointmentWizard({
  categoryGroups,
  packages,
  timezone,
  initialClient,
}: {
  categoryGroups: CategoryGroup[];
  packages: PackageOption[];
  timezone: string;
  initialClient?: { id: string; name: string; phoneE164: string } | undefined;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createManualBooking, null);
  const [seriesState, seriesFormAction, seriesPending] = useActionState(
    createRecurringSeries,
    null,
  );

  const [mainStep, setMainStep] = useState<MainStep>('client');
  const [inRecurrenceReview, setInRecurrenceReview] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const [clientSelection, setClientSelection] = useState<ClientSelection>(
    initialClient ? { mode: 'existing', client: initialClient } : { mode: 'none' },
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [observation, setObservation] = useState('');

  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [occurrenceCount, setOccurrenceCount] = useState(4);
  const [customIntervalDays, setCustomIntervalDays] = useState(14);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsError, setConflictsError] = useState<string | null>(null);
  const [occurrenceReviews, setOccurrenceReviews] = useState<OccurrenceReview[] | null>(null);

  const servicesById = useMemo(() => {
    const map = new Map<string, ServiceLine>();
    for (const group of categoryGroups)
      for (const service of group.services) map.set(service.id, service);
    return map;
  }, [categoryGroups]);

  const lines = cartLines(
    { selectedPackageId, selectedServiceIds: Array.from(selectedServiceIds) },
    servicesById,
    packages,
  );
  const { totalCents, totalMinutes } = cartTotals(lines);

  function toggleService(id: string) {
    const covered = new Set(packages.find((pkg) => pkg.id === selectedPackageId)?.serviceIds ?? []);
    if (covered.has(id)) return;
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

  // Availability depends only on total duration — reload whenever the cart's total
  // minutes change (a service added/removed, a package toggled), same trigger the old
  // form used.
  useEffect(() => {
    let cancelled = false;
    async function load() {
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

  useEffect(() => {
    if (!state?.ok) return;
    let cancelled = false;
    // Deferred: useActionState hands the wizard a *new* state reference exactly once per
    // completed submission, so this only ever reacts to that event — never a synchronous
    // render-time write.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      const dateTimeLabel = selectedSlotIso
        ? capitalize(
            formatInTimeZone(selectedSlotIso, timezone, "EEEE, dd 'de' MMMM 'às' HH:mm", {
              locale: pt,
            }),
          )
        : '';
      setSuccess({ kind: 'single', appointmentId: state.value.appointmentId, dateTimeLabel });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!seriesState?.ok) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      const dateTimeLabel = selectedSlotIso
        ? capitalize(
            formatInTimeZone(selectedSlotIso, timezone, "EEEE, dd 'de' MMMM 'às' HH:mm", {
              locale: pt,
            }),
          )
        : '';
      setSuccess({
        kind: 'series',
        occurrenceCount:
          occurrenceReviews?.filter((occurrence) => !occurrence.removed).length ?? occurrenceCount,
        dateTimeLabel,
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesState]);

  function resetWizard() {
    setSuccess(null);
    setMainStep('client');
    setInRecurrenceReview(false);
    setClientSelection({ mode: 'none' });
    setSelectedPackageId(null);
    setSelectedServiceIds(new Set());
    setSelectedSlotIso(null);
    setSlots(null);
    setObservation('');
    setRecurringEnabled(false);
    setOccurrenceReviews(null);
    setConflictsError(null);
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
      setInRecurrenceReview(true);
    } catch {
      setConflictsError('Não foi possível gerar as ocorrências.');
    } finally {
      setConflictsLoading(false);
    }
  }

  function canAdvance(step: MainStep): boolean {
    if (step === 'client') {
      if (clientSelection.mode === 'existing') return true;
      if (clientSelection.mode === 'new') {
        return clientSelection.name.trim().length >= 2 && clientSelection.phone.trim().length > 0;
      }
      return false;
    }
    if (step === 'services') return lines.length > 0;
    if (step === 'schedule') return selectedSlotIso !== null && !conflictsLoading;
    return true;
  }

  function goNext() {
    if (mainStep === 'schedule' && recurringEnabled) {
      void handlePreviewRecurrence();
      return;
    }
    const currentIndex = MAIN_STEPS.indexOf(mainStep);
    if (currentIndex < MAIN_STEPS.length - 1) setMainStep(MAIN_STEPS[currentIndex + 1]!);
  }

  function goBack() {
    const currentIndex = MAIN_STEPS.indexOf(mainStep);
    if (currentIndex > 0) setMainStep(MAIN_STEPS[currentIndex - 1]!);
  }

  if (success) {
    const clientName =
      clientSelection.mode === 'existing'
        ? clientSelection.client.name
        : clientSelection.mode === 'new'
          ? clientSelection.name
          : '';
    const clientPhoneE164 =
      clientSelection.mode === 'existing'
        ? clientSelection.client.phoneE164
        : clientSelection.mode === 'new'
          ? clientSelection.phone
          : null;
    return (
      <SuccessScreen
        kind={success.kind}
        appointmentId={success.kind === 'single' ? success.appointmentId : null}
        occurrenceCount={success.kind === 'series' ? success.occurrenceCount : null}
        clientName={clientName}
        clientPhoneE164={clientPhoneE164}
        dateTimeLabel={success.dateTimeLabel}
        totalCents={totalCents}
        onCreateAnother={resetWizard}
      />
    );
  }

  if (inRecurrenceReview && occurrenceReviews) {
    return (
      <div className="new-appointment-layout">
        <div>
          <RecurrenceReview
            occurrenceReviews={occurrenceReviews}
            setOccurrenceReviews={setOccurrenceReviews}
            frequency={frequency}
            timezone={timezone}
            clientSelection={clientSelection}
            selectedServiceIds={selectedServiceIds}
            selectedPackageId={selectedPackageId}
            observation={observation}
            intervalValue={frequency === 'custom' ? customIntervalDays : 1}
            formAction={seriesFormAction}
            pending={seriesPending}
            state={seriesState}
            onBack={() => setInRecurrenceReview(false)}
          />
        </div>
        <AppointmentSummaryPanel
          clientSelection={clientSelection}
          lines={lines}
          totalCents={totalCents}
          totalMinutes={totalMinutes}
          selectedSlotIso={selectedSlotIso}
          timezone={timezone}
        />
      </div>
    );
  }

  const stepIndex = MAIN_STEPS.indexOf(mainStep);

  return (
    <>
      <div className="new-appointment-header">
        <button
          type="button"
          className="new-appointment-back"
          aria-label="Voltar"
          onClick={() => (stepIndex === 0 ? router.push('/dashboard/agenda') : goBack())}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="new-appointment-title">Nova marcação</h1>
      </div>

      <WizardProgress stepIndex={stepIndex} />

      <div className="new-appointment-layout">
        <div>
          {mainStep === 'client' ? (
            <ClientStep value={clientSelection} onChange={setClientSelection} />
          ) : mainStep === 'services' ? (
            <ServicesStep
              categoryGroups={categoryGroups}
              packages={packages}
              selectedPackageId={selectedPackageId}
              selectedServiceIds={selectedServiceIds}
              onToggleService={toggleService}
              onSelectPackage={selectPackage}
            />
          ) : mainStep === 'schedule' ? (
            <ScheduleStep
              totalMinutes={totalMinutes}
              timezone={timezone}
              slots={slots}
              slotsError={slotsError}
              selectedSlotIso={selectedSlotIso}
              onSelectSlot={setSelectedSlotIso}
              recurringEnabled={recurringEnabled}
              onToggleRecurring={(enabled) => {
                setRecurringEnabled(enabled);
                setConflictsError(null);
              }}
              frequency={frequency}
              onFrequencyChange={setFrequency}
              occurrenceCount={occurrenceCount}
              onOccurrenceCountChange={setOccurrenceCount}
              customIntervalDays={customIntervalDays}
              onCustomIntervalDaysChange={setCustomIntervalDays}
              conflictsError={conflictsError}
              observation={observation}
              onObservationChange={setObservation}
            />
          ) : (
            <ConfirmStep
              clientSelection={clientSelection}
              lines={lines}
              selectedServiceIds={selectedServiceIds}
              selectedPackageId={selectedPackageId}
              totalCents={totalCents}
              totalMinutes={totalMinutes}
              selectedSlotIso={selectedSlotIso}
              timezone={timezone}
              recurringEnabled={recurringEnabled}
              frequency={frequency}
              occurrenceCount={occurrenceCount}
              observation={observation}
              onEditStep={setMainStep}
              formAction={formAction}
              pending={pending}
              state={state}
            />
          )}
        </div>

        <AppointmentSummaryPanel
          clientSelection={clientSelection}
          lines={lines}
          totalCents={totalCents}
          totalMinutes={totalMinutes}
          selectedSlotIso={selectedSlotIso}
          timezone={timezone}
        />
      </div>

      {mainStep !== 'confirm' ? (
        <div className="appointment-form-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={() => (stepIndex === 0 ? router.push('/dashboard/agenda') : goBack())}
          >
            Voltar
          </Button>
          <Button
            type="button"
            disabled={!canAdvance(mainStep) || conflictsLoading}
            onClick={goNext}
          >
            {mainStep === 'schedule' && recurringEnabled
              ? conflictsLoading
                ? 'A verificar…'
                : 'Rever ocorrências'
              : 'Continuar'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

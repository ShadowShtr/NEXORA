'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SlotPicker } from '../SlotPicker';
import { useBookingSession } from '../useBookingSession';
import {
  cartLines,
  cartTotals,
  type PackageOption,
  type ServiceLine,
} from '../domain/booking-selection';

// Visual refinement mid-2026: step 2 of the paginated public flow — a visitor who lands
// here without a selection (direct link, cleared session) is sent back to /servicos
// rather than shown an empty/broken calendar.
export function HorarioClient({
  tenantId,
  tenantSlug,
  timezone,
  services,
  packages,
  slotTaken = false,
}: {
  tenantId: string;
  tenantSlug: string;
  timezone: string;
  services: ServiceLine[];
  packages: PackageOption[];
  slotTaken?: boolean;
}) {
  const router = useRouter();
  const { state, ready, persist } = useBookingSession(tenantId, tenantSlug);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Seed selectedIso from the resumed draft exactly once, the moment the session
  // finishes loading — adjusting state during render (not in an effect) on that one
  // transition, same pattern as PackagesManager's cart-reset-on-create (React's
  // recommended shape for "sync local state when a tracked value changes"), so it never
  // stomps a slot the visitor just picked on this page.
  const [seededFromDraft, setSeededFromDraft] = useState(false);
  if (ready && !seededFromDraft) {
    setSeededFromDraft(true);
    setSelectedIso(state.selectedSlotIso);
  }

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const lines = cartLines(
    { selectedPackageId: state.selectedPackageId, selectedServiceIds: state.selectedServiceIds },
    servicesById,
    packages,
  );
  const { totalMinutes } = cartTotals(lines);

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      router.replace(`/b/${tenantSlug}/servicos`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lines.length]);

  function handleContinue() {
    if (!selectedIso) return;
    setPending(true);
    persist({ ...state, selectedSlotIso: selectedIso });
    router.push(`/b/${tenantSlug}/dados`);
  }

  if (!ready || lines.length === 0) return null;

  return (
    // A <main> landmark, not a Fragment — same axe finding (landmark-one-main/region)
    // already fixed once for the root public page (src/app/b/[slug]/page.tsx) applies
    // to every step of the paginated flow, not just the profile page.
    <main>
      <div className="public-booking-content">
        <header className="public-step-header">
          <Link href={`/b/${tenantSlug}/servicos`} className="nx-icon-button" aria-label="Voltar">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <h1 className="text-title">Escolha o dia</h1>
        </header>

        {slotTaken ? (
          <p role="alert" className="form-error">
            Este horário acabou de ser reservado por outra pessoa. Escolha outro.
          </p>
        ) : null}

        <SlotPicker
          tenantId={tenantId}
          timezone={timezone}
          totalMinutes={totalMinutes}
          selectedIso={selectedIso}
          onSelect={setSelectedIso}
          reloadKey={0}
        />
      </div>

      <div className="public-cart-bar">
        <span className="public-cart-bar-summary" role="status">
          {selectedIso ? 'Horário selecionado' : 'Escolha um horário'}
        </span>
        <Button type="button" disabled={!selectedIso || pending} onClick={handleContinue}>
          {pending ? 'A continuar…' : 'Continuar'}
        </Button>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { buildAppointmentReminderMessage, buildWhatsappDeepLink } from '../domain/appointment-card';
import { formatEuros } from '../domain/appointment-wizard';

// Step 31 of the redesign spec — "Ecrã de sucesso." Reuses the exact WhatsApp deep-link
// builder AppointmentCard.tsx already uses (domain/appointment-card.ts) so the message
// format never drifts between the agenda timeline and this screen.
export function SuccessScreen({
  kind,
  appointmentId,
  occurrenceCount,
  clientName,
  clientPhoneE164,
  dateTimeLabel,
  totalCents,
  onCreateAnother,
}: {
  kind: 'single' | 'series';
  appointmentId: string | null;
  occurrenceCount: number | null;
  clientName: string;
  clientPhoneE164: string | null;
  dateTimeLabel: string;
  totalCents: number;
  onCreateAnother: () => void;
}) {
  const whatsappHref = clientPhoneE164
    ? buildWhatsappDeepLink(
        clientPhoneE164,
        buildAppointmentReminderMessage(clientName, dateTimeLabel),
      )
    : null;

  return (
    <div className="appointment-success-screen">
      <span className="appointment-success-icon" aria-hidden="true">
        <CheckCircle2 size={40} />
      </span>
      <h2 className="step-title">Marcação criada com sucesso!</h2>
      <p className="step-description">
        {kind === 'series' && occurrenceCount
          ? `${occurrenceCount} marcações criadas para ${clientName}.`
          : `Reservado para ${clientName}.`}
      </p>

      <div className="appointment-success-summary">
        <span>{clientName}</span>
        <span className="text-support">{dateTimeLabel}</span>
        <span className="appointment-success-total">{formatEuros(totalCents)}</span>
      </div>

      <div className="appointment-success-actions">
        {kind === 'single' && appointmentId ? (
          <Link href={`/dashboard/agenda/${appointmentId}`} className="button">
            Ver marcação
          </Link>
        ) : (
          <Link href="/dashboard/agenda" className="button">
            Ver agenda
          </Link>
        )}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Abrir WhatsApp
          </a>
        ) : null}
        <Button variant="secondary" onClick={onCreateAnother}>
          Criar outra
        </Button>
        <Link href="/dashboard/agenda" className="link-button appointment-success-back">
          Voltar à agenda
        </Link>
      </div>
    </div>
  );
}

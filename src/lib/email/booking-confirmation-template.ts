import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import type { EmailMessage } from './provider';

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type BookingConfirmationEmailInput = {
  to: string;
  businessName: string;
  startAtIso: string;
  timezone: string;
  items: { description: string; unitPriceCents: number }[];
  totalCents: number;
  bookingUrl: string;
  lookupCode: string;
};

// NEX-074: the confirmation e-mail sent after a successful public booking (NEX-064).
// Deliberately minimal — a template, not a design system: this is a plain-text-first
// message (CLAUDE.md: booking flows favor simplicity over polish), rendered here rather
// than via a templating engine dependency for one small, static message.
export function buildBookingConfirmationEmail(input: BookingConfirmationEmailInput): EmailMessage {
  const dateLabel = capitalize(
    formatInTimeZone(input.startAtIso, input.timezone, "EEEE, dd 'de' MMMM 'às' HH:mm", {
      locale: pt,
    }),
  );

  const itemLines = input.items.map(
    (item) => `${item.description} — ${formatEuros(item.unitPriceCents)}`,
  );

  const text = [
    `A sua marcação em ${input.businessName} está confirmada.`,
    '',
    dateLabel,
    '',
    ...itemLines,
    '',
    `Total: ${formatEuros(input.totalCents)}`,
    '',
    `Ver marcação: ${input.bookingUrl}`,
    '',
    `Código para consultar mais tarde: ${input.lookupCode}`,
  ].join('\n');

  const html = `
    <p>A sua marcação em <strong>${escapeHtml(input.businessName)}</strong> está confirmada.</p>
    <p>${escapeHtml(dateLabel)}</p>
    <ul>
      ${input.items.map((item) => `<li>${escapeHtml(item.description)} — ${formatEuros(item.unitPriceCents)}</li>`).join('\n      ')}
    </ul>
    <p><strong>Total: ${formatEuros(input.totalCents)}</strong></p>
    <p><a href="${escapeHtml(input.bookingUrl)}">Ver marcação</a></p>
    <p>Código para consultar mais tarde: <strong>${escapeHtml(input.lookupCode)}</strong></p>
  `.trim();

  return {
    to: input.to,
    subject: `Marcação confirmada — ${input.businessName}`,
    text,
    html,
  };
}

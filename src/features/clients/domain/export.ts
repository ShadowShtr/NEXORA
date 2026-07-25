import type { ClientPreferences } from '@/features/clients/domain/preferences';

// NEX-162: "Exportar dados da cliente — export tenant-scoped e minimizado." Shapes the
// structured export a dona can download for one of her own clients (RGPD portabilidade/
// acesso, docs/05_SECURITY_PRIVACY.md "Direitos"). Deliberately excludes internal-only
// fields no data-subject request needs: row UUIDs, tenant_id, Storage paths/signed
// URLs, appointment/payment ids — only what describes the client herself and her own
// history. Kept as a pure function (raw-ish DB rows in, clean export shape out) so the
// transformation — cents→euros, picking final over expected total, resolving the paid
// method — is unit-tested without touching Supabase.

export type ClientExportAppointmentRow = {
  start_at: string;
  status: string;
  expected_total_cents: number;
  final_total_cents: number | null;
  appointment_items: { description: string }[] | null;
  payments: { method: string | null; status: string }[] | null;
};

export type ClientExportPhotoRow = {
  kind: string;
  created_at: string;
};

export type ClientExportAppointment = {
  date: string;
  status: string;
  services: string[];
  totalEuros: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
};

export type ClientExportPhoto = {
  kind: string;
  addedAt: string;
};

export type ClientExportPayload = {
  exportedAt: string;
  client: {
    name: string;
    phone: string;
    email: string | null;
    firstSeenAt: string | null;
    preferences: ClientPreferences;
    privateNotes: string;
  };
  appointments: ClientExportAppointment[];
  photos: ClientExportPhoto[];
};

function centsToEuros(cents: number): number {
  return Math.round(cents) / 100;
}

export function buildClientExport(input: {
  now: Date;
  client: {
    name: string;
    phone: string;
    email: string | null;
    firstSeenAt: string | null;
    preferences: ClientPreferences;
    privateNotes: string;
  };
  appointments: ClientExportAppointmentRow[];
  photos: ClientExportPhotoRow[];
}): ClientExportPayload {
  const appointments: ClientExportAppointment[] = input.appointments.map((appointment) => {
    const lastPayment = (appointment.payments ?? []).at(-1) ?? null;
    return {
      date: appointment.start_at,
      status: appointment.status,
      services: (appointment.appointment_items ?? []).map((item) => item.description),
      totalEuros: centsToEuros(appointment.final_total_cents ?? appointment.expected_total_cents),
      paymentMethod: lastPayment?.method ?? null,
      paymentStatus: lastPayment?.status ?? null,
    };
  });

  const photos: ClientExportPhoto[] = input.photos.map((photo) => ({
    kind: photo.kind,
    addedAt: photo.created_at,
  }));

  return {
    exportedAt: input.now.toISOString(),
    client: input.client,
    appointments,
    photos,
  };
}

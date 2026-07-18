'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientContactSchema } from '@/lib/validation/client';
import type { Result } from '@/lib/result';

const requestSchema = z.object({
  tenantId: z.uuid(),
  registration: clientContactSchema,
  selectedServiceIds: z.array(z.uuid()),
  selectedPackageId: z.uuid().nullable(),
  startAtIso: z.iso.datetime(),
  // Generated client-side (crypto.randomUUID() or equivalent, 32 random bytes hex) and
  // held by the caller across retries — generating it inside this action instead would
  // mint a fresh key on every retry, defeating idempotency entirely.
  idempotencyKey: z.string().regex(/^[0-9a-f]{64}$/, 'idempotencyKey must be 64 hex chars'),
});

export type CreateBookingRequest = z.infer<typeof requestSchema>;

// Public booking creation (NEX-064): delegates the actual work to
// create_public_booking (supabase/migrations/0007_create_public_booking.sql), a single
// security-definer transaction that upserts the client, snapshots priced/timed
// appointment_items from the live catalog, inserts the appointment (guarded against
// double-booking by appointments_no_overlap, NEX-063) and its 24h reminder. This action
// is a thin, validated boundary in front of that RPC — anon already has EXECUTE on it
// (the migration grants it directly, ADR-008-style), so a plain anon client would work
// too, but going through the service-role client keeps this consistent with every other
// public write in this feature (draft-actions.ts, NEX-052) and avoids depending on the
// browser session/cookie state that a server action call may or may not carry.
export async function createPublicBooking(
  request: CreateBookingRequest,
): Promise<Result<{ appointmentId: string; bookingToken: string | null; isReplay: boolean }>> {
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  const {
    tenantId,
    registration,
    selectedServiceIds,
    selectedPackageId,
    startAtIso,
    idempotencyKey,
  } = parsed.data;

  type CreatePublicBookingRow = {
    appointment_id: string;
    booking_token: string | null;
    is_replay: boolean;
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc('create_public_booking', {
      p_tenant_id: tenantId,
      p_client_name: registration.name,
      p_client_phone_e164: registration.phone,
      p_client_email: registration.email ?? null,
      p_selected_service_ids: selectedServiceIds,
      p_selected_package_id: selectedPackageId,
      p_start_at: startAtIso,
      p_idempotency_key: idempotencyKey,
    })
    .single<CreatePublicBookingRow>();

  if (error) {
    if (error.code === '23P01') {
      return {
        ok: false,
        error: { code: 'SLOT_TAKEN', message: 'Este horário acabou de ser reservado.' },
      };
    }
    if (error.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Este pedido já foi processado com dados diferentes.',
        },
      };
    }
    if (error.code === '42501') {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Negócio não encontrado.' } };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a marcação.' },
    };
  }

  return {
    ok: true,
    value: {
      appointmentId: data.appointment_id,
      bookingToken: data.booking_token,
      isReplay: data.is_replay,
    },
  };
}

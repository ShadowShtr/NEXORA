import { z } from 'zod';

// registration is nullable (not required) because the draft now round-trips the whole
// booking flow's state across separate pages (/servicos → /horario → /dados → /resumo,
// visual refinement mid-2026), not just the "seus dados" step onward — a visitor who has
// only picked services has a draft worth saving/resuming, but no registration yet.
// selectedSlotIso is likewise part of that same cross-page state.
export const draftPayloadSchema = z.object({
  registration: z
    .object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(1),
      email: z.string().trim().optional(),
    })
    .nullable(),
  selectedPackageId: z.uuid().nullable(),
  selectedServiceIds: z.array(z.uuid()),
  selectedSlotIso: z.iso.datetime().nullable(),
});

export type DraftPayload = z.infer<typeof draftPayloadSchema>;

export const EMPTY_DRAFT_PAYLOAD: DraftPayload = {
  registration: null,
  selectedPackageId: null,
  selectedServiceIds: [],
  selectedSlotIso: null,
};

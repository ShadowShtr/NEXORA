import { z } from 'zod';

export const draftPayloadSchema = z.object({
  registration: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(1),
    email: z.string().trim().optional(),
  }),
  selectedPackageId: z.uuid().nullable(),
  selectedServiceIds: z.array(z.uuid()),
});

export type DraftPayload = z.infer<typeof draftPayloadSchema>;

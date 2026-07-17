import { z } from 'zod';
import { normalizePhoneE164 } from '@/lib/phone';
import { isSafeMapsUrl } from '@/lib/maps-url';

export const businessStepSchema = z.object({
  professionalName: z.string().trim().min(2, 'Introduza o seu nome.').max(120),
  phone: z
    .string()
    .trim()
    .min(7, 'Introduza um número de telemóvel válido.')
    .max(24)
    .transform((value, ctx) => {
      const normalized = normalizePhoneE164(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Introduza um número de telemóvel válido.' });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.union([z.email('Introduza um e-mail válido.'), z.literal('')]),
  addressLine: z.string().trim().min(3, 'Introduza a morada.').max(160),
  postalCode: z.string().trim().min(4, 'Introduza o código postal.').max(12),
  locality: z.string().trim().min(2, 'Introduza a localidade.').max(80),
  mapsUrl: z
    .union([
      z
        .string()
        .trim()
        .url('Introduza um link válido.')
        .refine(isSafeMapsUrl, 'Use um link do Google Maps ou Apple Maps.'),
      z.literal(''),
    ])
    .default(''),
});

export type BusinessStepInput = z.infer<typeof businessStepSchema>;

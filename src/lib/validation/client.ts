import { z } from 'zod';
import { normalizePhoneE164 } from '@/lib/phone';

export const clientContactSchema = z.object({
  name: z.string().trim().min(2, 'Indique o seu nome.').max(120),
  phone: z
    .string()
    .trim()
    .min(1, 'Indique o seu telemóvel.')
    .transform((value, ctx) => {
      const normalized = normalizePhoneE164(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Indique um telemóvel válido.' });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.union([z.email('Indique um e-mail válido.'), z.literal('')]).optional(),
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;

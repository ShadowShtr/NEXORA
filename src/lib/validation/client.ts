import { z } from 'zod';

export const clientContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(24),
  email: z.union([z.email(), z.literal('')]).optional(),
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;

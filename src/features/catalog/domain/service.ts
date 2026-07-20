import { z } from 'zod';
import { priceEurosSchema } from '@/lib/validation/money';

// Matches the `services` check constraints (0001_initial.sql): name 1–120 chars,
// price_cents >= 0, duration_minutes between 5 and 720.
const nameSchema = z.string().trim().min(1, 'Indique o nome do serviço.').max(120);
const durationSchema = z.coerce
  .number()
  .int('Indique a duração em minutos.')
  .min(5, 'A duração mínima é 5 minutos.')
  .max(720, 'A duração máxima é 720 minutos.');

export const createServiceSchema = z.object({
  name: nameSchema,
  priceEuros: priceEurosSchema,
  durationMinutes: durationSchema,
  categoryId: z.uuid('Escolha uma categoria.'),
});

export const updateServiceSchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  priceEuros: priceEurosSchema,
  durationMinutes: durationSchema,
  categoryId: z.uuid('Escolha uma categoria.'),
});

export const serviceIdSchema = z.object({ id: z.uuid() });

export type ServiceListItem = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  categoryId: string;
  isActive: boolean;
  photoUrl: string | null;
};

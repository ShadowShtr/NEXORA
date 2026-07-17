import { z } from 'zod';
import { priceEurosSchema } from '@/lib/validation/money';

export const serviceItemSchema = z.object({
  name: z.string().trim().min(1, 'Indique o nome do serviço.').max(120),
  priceEuros: priceEurosSchema,
  durationMinutes: z.coerce
    .number()
    .int('Indique a duração em minutos.')
    .min(5, 'A duração mínima é 5 minutos.')
    .max(720, 'A duração máxima é 720 minutos.'),
  categoryName: z.string().trim().min(1, 'Indique uma categoria.').max(80),
});

export type ServiceItemInput = z.infer<typeof serviceItemSchema>;

export type ServiceListItem = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  categoryName: string;
};

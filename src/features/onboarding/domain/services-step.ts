import { z } from 'zod';

export const serviceItemSchema = z.object({
  name: z.string().trim().min(1, 'Indique o nome do serviço.').max(120),
  priceEuros: z
    .string()
    .trim()
    .min(1, 'Indique o preço.')
    .transform((value, ctx) => {
      const normalized = value.replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      if (Number.isNaN(parsed) || parsed < 0) {
        ctx.addIssue({ code: 'custom', message: 'Indique um preço válido.' });
        return z.NEVER;
      }
      return Math.round(parsed * 100);
    }),
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

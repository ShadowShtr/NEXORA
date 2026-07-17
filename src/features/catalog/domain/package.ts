import { z } from 'zod';
import { priceEurosSchema } from '@/lib/validation/money';

// Matches the `packages` check constraints (0001_initial.sql): name 1–120 chars,
// price_cents >= 0. `packages` has no duration column — duration is always derived
// from the sum of its services' durations (docs/04_DATA_MODEL.md #61), never stored.
const nameSchema = z.string().trim().min(1, 'Indique o nome do pacote.').max(120);

export const createPackageSchema = z.object({
  name: nameSchema,
  priceEuros: priceEurosSchema,
  serviceIds: z.array(z.uuid()).min(1, 'Escolha pelo menos um serviço.'),
});

export const updatePackageSchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  priceEuros: priceEurosSchema,
  serviceIds: z.array(z.uuid()).min(1, 'Escolha pelo menos um serviço.'),
});

export const packageIdSchema = z.object({ id: z.uuid() });

export type PackageListItem = {
  id: string;
  name: string;
  priceCents: number;
  isActive: boolean;
  serviceIds: string[];
};

// Duration is never stored — always the sum of the included services' durations
// (docs/04_DATA_MODEL.md #61).
export function derivePackageDurationMinutes(
  serviceIds: string[],
  servicesById: Map<string, { durationMinutes: number }>,
): number {
  return serviceIds.reduce((total, id) => total + (servicesById.get(id)?.durationMinutes ?? 0), 0);
}

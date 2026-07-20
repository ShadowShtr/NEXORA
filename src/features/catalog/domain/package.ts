import { z } from 'zod';
import { optionalPriceEurosSchema, priceEurosSchema } from '@/lib/validation/money';

// Matches the `packages` check constraints (0001_initial.sql): name 1–120 chars,
// price_cents >= 0. `packages` has no duration column — duration is always derived
// from the sum of its services' durations (docs/04_DATA_MODEL.md #61), never stored.
const nameSchema = z.string().trim().min(1, 'Indique o nome do pacote.').max(120);

// compareAtPriceEuros: an optional "before" price driving the promotional badge
// (0025_service_photos_and_package_promotions.sql) — mirrors the DB check constraint
// (compare_at_price_cents is null or > price_cents) so a bad value is caught here, with
// a field-specific message, before it ever reaches the database.
const packageFieldsSchema = z.object({
  name: nameSchema,
  priceEuros: priceEurosSchema,
  compareAtPriceEuros: optionalPriceEurosSchema,
  serviceIds: z.array(z.uuid()).min(1, 'Escolha pelo menos um serviço.'),
});

export const createPackageSchema = packageFieldsSchema.refine(
  (data) => data.compareAtPriceEuros === null || data.compareAtPriceEuros > data.priceEuros,
  {
    message: 'O preço promocional tem de ser inferior ao preço original.',
    path: ['compareAtPriceEuros'],
  },
);

export const updatePackageSchema = packageFieldsSchema
  .extend({ id: z.uuid() })
  .refine(
    (data) => data.compareAtPriceEuros === null || data.compareAtPriceEuros > data.priceEuros,
    {
      message: 'O preço promocional tem de ser inferior ao preço original.',
      path: ['compareAtPriceEuros'],
    },
  );

export const packageIdSchema = z.object({ id: z.uuid() });

export type PackageListItem = {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  isActive: boolean;
  serviceIds: string[];
};

// Never stored — always derived from the two prices so it can't drift out of sync
// (0025_service_photos_and_package_promotions.sql). Returns null when there is no
// active promotion (no compare-at price, or it no longer exceeds the current price).
export function packageDiscountPercent(
  priceCents: number,
  compareAtPriceCents: number | null,
): number | null {
  if (compareAtPriceCents === null || compareAtPriceCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtPriceCents) * 100);
}

// Duration is never stored — always the sum of the included services' durations
// (docs/04_DATA_MODEL.md #61).
export function derivePackageDurationMinutes(
  serviceIds: string[],
  servicesById: Map<string, { durationMinutes: number }>,
): number {
  return serviceIds.reduce((total, id) => total + (servicesById.get(id)?.durationMinutes ?? 0), 0);
}

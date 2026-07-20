import { z } from 'zod';

// docs/01_PRODUCT_REQUIREMENTS.md §10: "preferências de cores, formatos, técnicas e
// produtos" — four free-text fields, not a tag/chip picker. clients.preferences is a
// bare jsonb column (0001_initial.sql) with no schema of its own; this is the first
// task to give it a concrete shape, kept intentionally simple (plain text per
// category) rather than inventing a taxonomy the product hasn't specified yet.
export const clientPreferencesSchema = z.object({
  colors: z.string().trim().max(500).default(''),
  formats: z.string().trim().max(500).default(''),
  techniques: z.string().trim().max(500).default(''),
  products: z.string().trim().max(500).default(''),
});

export type ClientPreferences = z.infer<typeof clientPreferencesSchema>;

export const EMPTY_PREFERENCES: ClientPreferences = {
  colors: '',
  formats: '',
  techniques: '',
  products: '',
};

// clients.preferences defaults to '{}'::jsonb (0001_initial.sql) and may contain keys
// from a shape predating this task — parse leniently (missing/extra keys default to
// '') instead of throwing on old rows.
export function parseClientPreferences(raw: unknown): ClientPreferences {
  const result = clientPreferencesSchema.safeParse(raw);
  return result.success ? result.data : EMPTY_PREFERENCES;
}

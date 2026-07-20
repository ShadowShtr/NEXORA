import { z } from 'zod';

// Shared "25,00" / "25.00" euro-string → integer cents parser. Monetary values are
// always integer cents internally (CLAUDE.md: never float) — this is the one place
// that boundary conversion happens, reused everywhere a euro amount is typed in.
export const priceEurosSchema = z
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
  });

// Same "25,00" -> integer cents parsing, but a missing field, null, or an empty string
// are all a valid "not set" (e.g. a package's optional promotional compare-at price)
// rather than a validation error — formData.get() returns null for a field the caller
// never included at all, not just an empty string.
export const optionalPriceEurosSchema = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    const trimmed = value?.trim() ?? '';
    if (trimmed === '') return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({ code: 'custom', message: 'Indique um preço válido.' });
      return z.NEVER;
    }
    return Math.round(parsed * 100);
  });

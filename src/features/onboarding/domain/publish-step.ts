import { z } from 'zod';

// Must match the `tenants.slug` check constraint (0001_initial.sql):
// ^[a-z0-9]+(?:-[a-z0-9]+)*$
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;

// Best-effort suggestion only — the DB constraint is the real authority, and the
// server action re-validates with slugSchema regardless of client input.
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const slugSchema = z
  .string()
  .trim()
  .min(SLUG_MIN_LENGTH, `O link deve ter pelo menos ${SLUG_MIN_LENGTH} caracteres.`)
  .max(SLUG_MAX_LENGTH, `O link deve ter no máximo ${SLUG_MAX_LENGTH} caracteres.`)
  .regex(SLUG_PATTERN, 'Use apenas letras minúsculas, números e hífens (ex.: joana-unhas).');

export const publishStepSchema = z.object({ slug: slugSchema });

export function publicBookingUrl(appUrl: string, slug: string): string {
  return `${appUrl}/b/${slug}`;
}

import { isSafeMapsUrl } from '@/lib/maps-url';

export type LocationAddress = {
  addressLine: string | null;
  postalCode: string | null;
  locality: string | null;
};

// NEX-073: "Ecrã final oferece: ver marcação, adicionar ao calendário e abrir
// localização" (docs/01_PRODUCT_REQUIREMENTS.md §3.12). The owner's own maps_url
// (NEX-031, src/features/onboarding/domain/business-step.ts) is already validated
// against isSafeMapsUrl at write time — re-checking it here is still worthwhile because
// this function's contract must hold even if a row somehow bypassed that validation
// (a direct DB edit, a future admin tool), and because it's the one place that decides
// whether to trust the stored link or fall back to the address.
//
// The fallback is a Google Maps *search* URL built from the address text, not a
// geocoded pin — this product never stores coordinates, only the free-text address
// fields collected in onboarding, so a search query is the only fallback available
// without adding a geocoding dependency.
export function resolveLocationUrl(
  mapsUrl: string | null,
  address: LocationAddress,
): string | null {
  if (mapsUrl && isSafeMapsUrl(mapsUrl)) return mapsUrl;

  const parts = [address.addressLine, address.postalCode, address.locality].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length === 0) return null;

  const query = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

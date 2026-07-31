// NEX-214: "Preço/duração específicos ficam ocultos atrás de 'Personalizar para esta
// pessoa' no primeiro lançamento" (UI concern, EPIC-19.md/NEX-217) — this is the
// backend counterpart: an override of null on either field means "use the base
// service's own value", not "zero"/"unset the service". Same fallback philosophy as
// resolveProviderDayHours (NEX-213): absence of an override *is* the inheritance
// signal, not a separate flag.
export type BaseService = Readonly<{
  priceCents: number;
  durationMinutes: number;
}>;

export type ProviderServiceOverride = Readonly<{
  priceCents: number | null;
  durationMinutes: number | null;
}>;

export type EffectiveProviderService = Readonly<{
  priceCents: number;
  durationMinutes: number;
}>;

export function resolveEffectiveProviderService(
  base: BaseService,
  override: ProviderServiceOverride,
): EffectiveProviderService {
  return {
    priceCents: override.priceCents ?? base.priceCents,
    durationMinutes: override.durationMinutes ?? base.durationMinutes,
  };
}

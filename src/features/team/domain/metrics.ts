// NEX-219: "Métricas: prestadores ativos, utilização por prestador, horas disponíveis,
// horas ocupadas, conflitos evitados." Domain-only aggregation here — deliberately no
// Supabase query in this file, so it can be unit-tested without a database. A relatórios
// page that fetches occupied/available minutes per provider and feeds them through
// this is future work (not built this batch); "conflitos evitados" has no home yet
// either — nothing in the schema logs a blocked booking attempt as a distinct event
// (the exclusion constraints just fail the insert, nothing records why), so there is no
// real data to aggregate for it without adding that instrumentation first.
export type ProviderUtilization = Readonly<{
  providerId: string;
  availableMinutes: number;
  occupiedMinutes: number;
  utilizationPercent: number;
}>;

export function computeProviderUtilization(
  providerId: string,
  availableMinutes: number,
  occupiedMinutes: number,
): ProviderUtilization {
  if (availableMinutes < 0 || occupiedMinutes < 0) {
    throw new Error('Minutes cannot be negative');
  }
  const utilizationPercent =
    availableMinutes === 0 ? 0 : Math.round((occupiedMinutes / availableMinutes) * 100);
  return { providerId, availableMinutes, occupiedMinutes, utilizationPercent };
}

export type TeamMetricsSummary = Readonly<{
  activeProviderCount: number;
  totalAvailableMinutes: number;
  totalOccupiedMinutes: number;
  averageUtilizationPercent: number;
}>;

export function summarizeTeamMetrics(
  utilizations: readonly ProviderUtilization[],
): TeamMetricsSummary {
  const totalAvailableMinutes = utilizations.reduce((sum, u) => sum + u.availableMinutes, 0);
  const totalOccupiedMinutes = utilizations.reduce((sum, u) => sum + u.occupiedMinutes, 0);
  const averageUtilizationPercent =
    utilizations.length === 0
      ? 0
      : Math.round(
          utilizations.reduce((sum, u) => sum + u.utilizationPercent, 0) / utilizations.length,
        );

  return {
    activeProviderCount: utilizations.length,
    totalAvailableMinutes,
    totalOccupiedMinutes,
    averageUtilizationPercent,
  };
}

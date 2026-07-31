import { describe, expect, it } from 'vitest';
import { computeProviderUtilization, summarizeTeamMetrics } from '@/features/team/domain/metrics';

describe('computeProviderUtilization (NEX-219)', () => {
  it('computes a rounded percentage of occupied over available minutes', () => {
    const result = computeProviderUtilization('provider-1', 480, 240);
    expect(result).toEqual({
      providerId: 'provider-1',
      availableMinutes: 480,
      occupiedMinutes: 240,
      utilizationPercent: 50,
    });
  });

  it('returns 0% (not NaN/Infinity) when a provider has no available minutes at all', () => {
    const result = computeProviderUtilization('provider-2', 0, 0);
    expect(result.utilizationPercent).toBe(0);
  });

  it('rejects negative minutes', () => {
    expect(() => computeProviderUtilization('provider-3', -1, 0)).toThrow(
      'Minutes cannot be negative',
    );
    expect(() => computeProviderUtilization('provider-3', 0, -1)).toThrow(
      'Minutes cannot be negative',
    );
  });
});

describe('summarizeTeamMetrics (NEX-219)', () => {
  it('sums minutes and averages utilization across providers', () => {
    const summary = summarizeTeamMetrics([
      computeProviderUtilization('a', 480, 240),
      computeProviderUtilization('b', 480, 480),
    ]);
    expect(summary).toEqual({
      activeProviderCount: 2,
      totalAvailableMinutes: 960,
      totalOccupiedMinutes: 720,
      averageUtilizationPercent: 75,
    });
  });

  it('returns zeroed metrics for an empty team, not a division error', () => {
    expect(summarizeTeamMetrics([])).toEqual({
      activeProviderCount: 0,
      totalAvailableMinutes: 0,
      totalOccupiedMinutes: 0,
      averageUtilizationPercent: 0,
    });
  });
});

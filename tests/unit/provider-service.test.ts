import { describe, expect, it } from 'vitest';
import { resolveEffectiveProviderService } from '@/features/appointments/domain/provider-service';

describe('resolveEffectiveProviderService (NEX-214)', () => {
  const base = { priceCents: 2000, durationMinutes: 45 };

  it('falls back to the base service price/duration when there is no override at all', () => {
    const effective = resolveEffectiveProviderService(base, {
      priceCents: null,
      durationMinutes: null,
    });
    expect(effective).toEqual({ priceCents: 2000, durationMinutes: 45 });
  });

  it('uses the override price while still falling back to the base duration', () => {
    const effective = resolveEffectiveProviderService(base, {
      priceCents: 2500,
      durationMinutes: null,
    });
    expect(effective).toEqual({ priceCents: 2500, durationMinutes: 45 });
  });

  it('uses the override duration while still falling back to the base price', () => {
    const effective = resolveEffectiveProviderService(base, {
      priceCents: null,
      durationMinutes: 60,
    });
    expect(effective).toEqual({ priceCents: 2000, durationMinutes: 60 });
  });

  it('uses both overrides when both are set ("Personalizar para esta pessoa")', () => {
    const effective = resolveEffectiveProviderService(base, {
      priceCents: 2500,
      durationMinutes: 60,
    });
    expect(effective).toEqual({ priceCents: 2500, durationMinutes: 60 });
  });

  it('an override of exactly 0 cents is respected, not treated as "unset"', () => {
    // 0 is a valid (if unusual) price — only null means "inherit", per the check
    // constraint in 0042_provider_services.sql (price_cents >= 0, nullable).
    const effective = resolveEffectiveProviderService(base, {
      priceCents: 0,
      durationMinutes: null,
    });
    expect(effective.priceCents).toBe(0);
  });
});

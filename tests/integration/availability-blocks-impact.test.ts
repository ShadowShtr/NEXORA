import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeAvailableSlotsMs } from '@/lib/availability-lookup';
import {
  timedBlockRange,
  weeklyRecurringBlockRanges,
} from '@/features/appointments/domain/availability-blocks';

// NEX-124's own required test category ("Impacto em slots"): proves the two block kinds
// NOT already covered by NEX-062's all-day-block test (public-availability.test.ts) —
// a same-day partial-time block ("pontual") and a multi-week recurring block
// ("semanal") — actually suppress the right slots and nothing else, through the same
// computeAvailableSlotsMs (NEX-083) engine every booking surface already relies on.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && publishableKey && serviceRoleKey);

const TZ = 'Europe/Lisbon';

describe.runIf(canRun)('availability_blocks impact on slots (NEX-124)', () => {
  let admin: SupabaseClient;
  const tenantId = randomUUID();
  const slug = `nex124-${tenantId.slice(0, 8)}`;

  const settings = {
    timezone: TZ,
    slotIntervalMinutes: 30 as const,
    bufferMinutes: 0,
    minNoticeHours: 0,
    bookingWindowDays: 60,
  };

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    await admin.from('tenants').insert({ id: tenantId, slug, name: 'Tenant', status: 'active' });

    const everyDayOpen = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      tenant_id: tenantId,
      day_of_week: dayOfWeek,
      is_open: true,
      opens_at: '09:00',
      closes_at: '18:00',
    }));
    await admin.from('business_hours').insert(everyDayOpen);
  });

  afterAll(async () => {
    await admin.from('tenants').delete().eq('id', tenantId);
  });

  it('a pontual (partial-day) block removes only the overlapping slots that day, not the whole day', async () => {
    const dateKey = formatInTimeZone(Date.now() + 3 * 24 * 60 * 60_000, TZ, 'yyyy-MM-dd');
    const range = timedBlockRange(dateKey, '10:00', '12:00', TZ);
    const { error } = await admin.from('availability_blocks').insert({
      tenant_id: tenantId,
      starts_at: new Date(range.startsAtMs).toISOString(),
      ends_at: new Date(range.endsAtMs).toISOString(),
      reason: 'pontual test block',
      is_all_day: false,
    });
    expect(error).toBeNull();

    const slotsMs = await computeAvailableSlotsMs(admin, tenantId, settings, 30);
    const slotsThatDay = slotsMs
      .filter((ms) => formatInTimeZone(ms, TZ, 'yyyy-MM-dd') === dateKey)
      .map((ms) => formatInTimeZone(ms, TZ, 'HH:mm'));

    // 09:00-10:00 and 12:00-18:00 stay free (30-min slots, no buffer); nothing inside
    // [10:00, 12:00) survives.
    expect(slotsThatDay).toContain('09:00');
    expect(slotsThatDay).toContain('12:00');
    expect(slotsThatDay.some((time) => time >= '10:00' && time < '12:00')).toBe(false);
  });

  it('a semanal recorrente block removes the same window on every one of its occurrences, and nowhere else', async () => {
    const firstDateKey = formatInTimeZone(Date.now() + 14 * 24 * 60 * 60_000, TZ, 'yyyy-MM-dd');
    const ranges = weeklyRecurringBlockRanges(firstDateKey, '13:00', '15:00', TZ, 3);
    const { error } = await admin.from('availability_blocks').insert(
      ranges.map((range) => ({
        tenant_id: tenantId,
        starts_at: new Date(range.startsAtMs).toISOString(),
        ends_at: new Date(range.endsAtMs).toISOString(),
        reason: 'semanal test block',
        is_all_day: false,
      })),
    );
    expect(error).toBeNull();

    const slotsMs = await computeAvailableSlotsMs(admin, tenantId, settings, 30);
    const dateKeys = ranges.map((_, index) =>
      formatInTimeZone(Date.now() + (14 + index * 7) * 24 * 60 * 60_000, TZ, 'yyyy-MM-dd'),
    );

    for (const dateKey of dateKeys) {
      const timesThatDay = slotsMs
        .filter((ms) => formatInTimeZone(ms, TZ, 'yyyy-MM-dd') === dateKey)
        .map((ms) => formatInTimeZone(ms, TZ, 'HH:mm'));
      expect(timesThatDay.some((time) => time >= '13:00' && time < '15:00')).toBe(false);
      expect(timesThatDay).toContain('09:00'); // rest of that day stays free
    }

    // One week before the pattern starts is untouched — the block doesn't leak earlier.
    const weekBeforeKey = formatInTimeZone(Date.now() + 7 * 24 * 60 * 60_000, TZ, 'yyyy-MM-dd');
    const timesWeekBefore = slotsMs
      .filter((ms) => formatInTimeZone(ms, TZ, 'yyyy-MM-dd') === weekBeforeKey)
      .map((ms) => formatInTimeZone(ms, TZ, 'HH:mm'));
    expect(timesWeekBefore).toContain('13:00');
  });
});

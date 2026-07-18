import { formatInTimeZone } from 'date-fns-tz';

export type FreeSlotsByDay = Readonly<{ dateKey: string; count: number; slotsIso: string[] }>;

// NEX-083: "Contagem e drawer/lista sem poluir agenda" — groups the flat instant list
// generateTimezoneAwareSlots (NEX-061, via computeAvailableSlotsMs) returns into one
// entry per local calendar day, sorted chronologically, so the agenda page can show a
// single count per day/period and only reveal the full time list inside a collapsed
// drawer instead of always rendering every slot inline.
export function groupFreeSlotsByDay(
  slotsMs: readonly number[],
  timeZone: string,
): FreeSlotsByDay[] {
  const byDay = new Map<string, string[]>();

  for (const ms of slotsMs) {
    const iso = new Date(ms).toISOString();
    const dateKey = formatInTimeZone(ms, timeZone, 'yyyy-MM-dd');
    const list = byDay.get(dateKey) ?? [];
    list.push(iso);
    byDay.set(dateKey, list);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, slotsIso]) => ({ dateKey, count: slotsIso.length, slotsIso }));
}

export function filterFreeSlotsInRange(
  groups: readonly FreeSlotsByDay[],
  dateKeys: readonly string[],
): FreeSlotsByDay[] {
  const allowed = new Set(dateKeys);
  return groups.filter((group) => allowed.has(group.dateKey));
}

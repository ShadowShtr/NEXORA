import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';

export type SlotGroup = Readonly<{
  dateKey: string;
  dateLabel: string;
  slots: readonly { iso: string; timeLabel: string }[];
}>;

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

// Groups a flat list of ISO instants (as returned by getPublicAvailability, NEX-062)
// into one entry per calendar day in the tenant's timezone, each with a short pt-PT
// label — the shape the public "choose a time" step (NEX-065) renders directly, so a
// visitor never has to parse a raw ISO timestamp. `durationMinutes` (the cart's total,
// when known) turns timeLabel into a "start - end" range instead of a bare start time —
// a visitor can see at a glance whether a slot actually fits before their next
// commitment, without needing to already know the service duration by heart.
export function groupSlotsByDay(
  slotsIso: readonly string[],
  timeZone: string,
  durationMinutes?: number,
): SlotGroup[] {
  const groups = new Map<
    string,
    { dateLabel: string; slots: { iso: string; timeLabel: string }[] }
  >();

  for (const iso of slotsIso) {
    const dateKey = formatInTimeZone(iso, timeZone, 'yyyy-MM-dd');
    const startLabel = formatInTimeZone(iso, timeZone, 'HH:mm');
    const timeLabel = durationMinutes
      ? `${startLabel} - ${formatInTimeZone(new Date(iso).getTime() + durationMinutes * 60_000, timeZone, 'HH:mm')}`
      : startLabel;
    if (!groups.has(dateKey)) {
      const dateLabel = capitalize(formatInTimeZone(iso, timeZone, 'EEEE · dd/MM', { locale: pt }));
      groups.set(dateKey, { dateLabel, slots: [] });
    }
    groups.get(dateKey)!.slots.push({ iso, timeLabel });
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, group]) => ({ dateKey, ...group }));
}

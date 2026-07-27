// Calendar-day grouping/month-grid building for the schedule step reuses the public
// booking flow's own domain modules (src/app/b/[slug]/domain/{slot-formatting,
// month-calendar}.ts) directly — same availability shape (getManualBookingAvailability
// mirrors getPublicAvailability, NEX-085's own comment says so), so there was no reason
// to duplicate that logic here.

export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// date-fns-tz's pt locale lowercases weekday/month names ("terça-feira") — every date
// label in this wizard that leads with EEEE/MMMM needs this, same as every other
// pt-PT-locale date label elsewhere in the app (each file keeps its own tiny copy;
// this one is shared across the wizard's own files only).
export function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

// "1 h 35 min" / "45 min" / "2 h" — used everywhere the wizard shows a running total
// duration (sticky summary, review card, desktop sidebar).
export function formatDurationLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

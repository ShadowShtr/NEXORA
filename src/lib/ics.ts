// Minimal RFC 5545 (iCalendar) VEVENT generator for NEX-072. No external dependency —
// a single confirmed event with fixed fields is a small enough surface that a library
// would add more risk (supply chain, CLAUDE.md) than it saves.

function formatUtc(iso: string): string {
  // "YYYYMMDDTHHMMSSZ" — RFC 5545 §3.3.5 form 2 (UTC time). Building from the ISO
  // string's own UTC fields (not toISOString() sliced by hand) keeps this correct
  // regardless of what offset the input ISO string was originally expressed in.
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeText(value: string): string {
  // RFC 5545 §3.3.11: backslash, semicolon, comma and newline must be escaped in TEXT
  // values (SUMMARY, DESCRIPTION, LOCATION).
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// RFC 5545 §3.1: content lines longer than 75 octets should be folded — a continuation
// line starts with a single space. Most modern calendar clients tolerate long lines,
// but folding costs little and keeps this spec-compliant for stricter parsers.
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, maxLength));
  rest = rest.slice(maxLength);
  while (rest.length > 0) {
    parts.push(rest.slice(0, maxLength - 1));
    rest = rest.slice(maxLength - 1);
  }
  return parts.join('\r\n ');
}

export type IcsEventInput = {
  uid: string;
  startAtIso: string;
  endAtIso: string;
  summary: string;
  description?: string | undefined;
  location?: string | undefined;
  createdAtIso?: string | undefined;
};

// Deliberately generates just one VEVENT — the product has one booking per token, not a
// recurring series (recurrence is a separate future epic, NEX-120+), so there is
// nothing to loop over yet.
export function generateIcsEvent(input: IcsEventInput): string {
  const now = input.createdAtIso
    ? formatUtc(input.createdAtIso)
    : formatUtc(new Date().toISOString());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEXORA//Booking//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatUtc(input.startAtIso)}`,
    `DTEND:${formatUtc(input.endAtIso)}`,
    `SUMMARY:${escapeText(input.summary)}`,
  ];

  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// NEX-104: "Personalizar template simples" — "Placeholders allowlisted e preview."
// Only these three tokens are ever substituted; any other {{...}} in the template is
// left untouched rather than treated as an error, so a dona who mistypes a placeholder
// (or pastes literal double braces) gets a message with that text still visible, not a
// silently broken/rejected save. The template itself is free text (validated for length
// only) — this is not a templating engine, no conditionals/loops, matching "simples".
export const REMINDER_TEMPLATE_PLACEHOLDERS = ['{{cliente}}', '{{data}}', '{{hora}}'] as const;
export type ReminderTemplatePlaceholder = (typeof REMINDER_TEMPLATE_PLACEHOLDERS)[number];

export const DEFAULT_REMINDER_TEMPLATE =
  'Olá {{cliente}}! Só a confirmar a sua marcação de {{data}} às {{hora}}.';

export const REMINDER_TEMPLATE_MAX_LENGTH = 500;

export interface ReminderTemplateValues {
  clientName: string;
  dateLabel: string;
  timeLabel: string;
}

// A single regex pass with a replacer function, not chained .replaceAll() calls —
// chaining would substitute {{cliente}} first, and if the client's own name happens to
// contain literal text like "{{data}}", the next .replaceAll('{{data}}', ...) call
// would re-scan the whole string and wrongly substitute inside what was just inserted.
// One pass over the *original* template, matching only the three known tokens, means a
// value's own content is never re-interpreted as a placeholder.
export function renderReminderTemplate(template: string, values: ReminderTemplateValues): string {
  return template.replace(/\{\{cliente\}\}|\{\{data\}\}|\{\{hora\}\}/g, (match) => {
    if (match === '{{cliente}}') return values.clientName;
    if (match === '{{data}}') return values.dateLabel;
    return values.timeLabel;
  });
}

// "Placeholders allowlisted": a template referencing anything other than the three
// known tokens is rejected at save time — rather than silently rendering the unknown
// "{{...}}" as literal text (which renderReminderTemplate above does, since that
// function also has to handle already-saved/legacy templates gracefully). This is the
// actual allowlist enforcement; renderReminderTemplate's tolerance is a defensive
// fallback for data that predates or bypassed this check, not a substitute for it.
const PLACEHOLDER_PATTERN = /\{\{[^}]*\}\}/g;

export function findDisallowedPlaceholders(template: string): string[] {
  const found = template.match(PLACEHOLDER_PATTERN) ?? [];
  const allowed = new Set<string>(REMINDER_TEMPLATE_PLACEHOLDERS);
  return [...new Set(found.filter((token) => !allowed.has(token)))];
}

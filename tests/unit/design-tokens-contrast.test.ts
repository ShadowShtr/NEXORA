import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from '@/lib/color-contrast';

// NEX-150: "Design system claymorphism — tokens, componentes e contraste AA." Reads the
// :root tokens straight out of globals.css (not a duplicated copy) so this test can
// never drift from what's actually shipped — editing a token hex without keeping AA
// fails here instead of shipping a silent regression. Pairs below are the real
// foreground/background combinations globals.css uses for literal text (see each pair's
// comment for the CSS rule it backs); decorative-only uses (icons, borders, dots) are
// governed by the more lenient 3:1 WCAG 1.4.11 rule and are not covered here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const globalsCss = readFileSync(path.join(__dirname, '../../src/app/globals.css'), 'utf-8');

function token(name: string): string {
  const match = globalsCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  const hex = match?.[1];
  if (!hex) throw new Error(`Design token --${name} not found in globals.css`);
  return hex;
}

const white = '#ffffff';
const pink50 = token('pink-50');
const pink500 = token('pink-500');
const pink600 = token('pink-600');
const text = token('text');
const muted = token('muted');
const success = token('success');
const danger = token('danger');
const warning = token('warning');

const pairs: Array<[string, string, string]> = [
  ['--text on --pink-50 (default body copy)', text, pink50],
  ['--text on white (cards)', text, white],
  ['--muted on --pink-50 (.text-support)', muted, pink50],
  ['--muted on white (.text-support on cards)', muted, white],
  ['--pink-600 on white (headings, .text-eyebrow, links)', pink600, white],
  ['--pink-600 on --pink-50', pink600, pink50],
  ['--pink-500 on white (.client-total-value, active filter chip)', pink500, white],
  ['--pink-500 on --pink-50', pink500, pink50],
  ['white on --pink-500 (.button/.fab gradient, lightest stop)', white, pink500],
  ['white on --pink-600 (.button/.fab gradient, darkest stop)', white, pink600],
  ['--success on white (appointment status "concluído")', success, white],
  ['--success on --pink-50', success, pink50],
  ['--danger on white (.form-error, appointment status "faltou")', danger, white],
  ['--danger on --pink-50', danger, pink50],
  ['--warning on white (NEX-154: pagamento pendente)', warning, white],
  ['--warning on --pink-50', warning, pink50],
];

describe('design tokens — WCAG AA contrast (globals.css :root)', () => {
  it.each(pairs)('%s meets AA (>= 4.5:1)', (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

// Normalizes to E.164 (CLAUDE.md: phone numbers must be normalized before persistence).
// No external phone-parsing library: this product targets Portugal-based
// professionals, so a small default-country normalizer is enough — already-E.164
// input from any country still passes through unchanged.
export function normalizePhoneE164(
  input: string,
  defaultCountryCallingCode = '351',
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[\s().-]/g, '');

  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`;
  }

  if (!digits.startsWith('+')) {
    digits = digits.replace(/^0+/, '');
    digits = `+${defaultCountryCallingCode}${digits}`;
  }

  return E164_PATTERN.test(digits) ? digits : null;
}

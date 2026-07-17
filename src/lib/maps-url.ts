// "Maps URL segura" (NEX-031): only accept https links to known map providers, never
// an arbitrary URL — closes off open-redirect/PII-leak surface from a free-text field
// that gets shown directly to clients on the public booking page (NEX-073).
const ALLOWED_EXACT_HOSTS = new Set([
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'maps.apple.com',
]);

export function isSafeMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.hostname === 'www.google.com' || url.hostname === 'google.com') {
    return url.pathname.startsWith('/maps');
  }
  return ALLOWED_EXACT_HOSTS.has(url.hostname);
}

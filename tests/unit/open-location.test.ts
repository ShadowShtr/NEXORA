import { describe, expect, it } from 'vitest';
import { resolveLocationUrl } from '@/lib/open-location';

const address = { addressLine: 'Rua Teste 1', postalCode: '1000-000', locality: 'Lisboa' };

describe('resolveLocationUrl', () => {
  it('prefers a safe maps_url over the address fallback', () => {
    const url = resolveLocationUrl('https://maps.google.com/?q=Lisboa', address);
    expect(url).toBe('https://maps.google.com/?q=Lisboa');
  });

  it('falls back to a Google Maps search built from the address when maps_url is null', () => {
    const url = resolveLocationUrl(null, address);
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20Teste%201%2C%201000-000%2C%20Lisboa',
    );
  });

  it('falls back to the address when maps_url is an unsafe/malicious URL', () => {
    const url = resolveLocationUrl('https://evil.example.com/track?redirect=/dashboard', address);
    expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(url).not.toContain('evil.example.com');
  });

  it('falls back to the address when maps_url is an empty string', () => {
    const url = resolveLocationUrl('', address);
    expect(url).toContain('google.com/maps/search');
  });

  it('omits missing address parts from the fallback query instead of leaving gaps', () => {
    const url = resolveLocationUrl(null, {
      addressLine: 'Rua Teste 1',
      postalCode: null,
      locality: 'Lisboa',
    });
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Rua%20Teste%201%2C%20Lisboa');
  });

  it('returns null when there is neither a safe maps_url nor any address data', () => {
    const url = resolveLocationUrl(null, { addressLine: null, postalCode: null, locality: null });
    expect(url).toBeNull();
  });
});

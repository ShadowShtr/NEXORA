import { describe, expect, it } from 'vitest';
import { isSafeMapsUrl } from '@/lib/maps-url';

describe('isSafeMapsUrl', () => {
  it('accepts known map provider hosts over https', () => {
    expect(isSafeMapsUrl('https://maps.google.com/?q=Lisboa')).toBe(true);
    expect(isSafeMapsUrl('https://goo.gl/maps/abc123')).toBe(true);
    expect(isSafeMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isSafeMapsUrl('https://maps.apple.com/?address=Lisboa')).toBe(true);
  });

  it('accepts google.com only under the /maps path', () => {
    expect(isSafeMapsUrl('https://www.google.com/maps/place/Lisboa')).toBe(true);
    expect(isSafeMapsUrl('https://www.google.com/search?q=Lisboa')).toBe(false);
  });

  it('rejects non-https protocols', () => {
    expect(isSafeMapsUrl('http://maps.google.com/?q=Lisboa')).toBe(false);
    expect(isSafeMapsUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects unknown hosts', () => {
    expect(isSafeMapsUrl('https://evil.example.com/track?redirect=/dashboard')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isSafeMapsUrl('not a url')).toBe(false);
    expect(isSafeMapsUrl('')).toBe(false);
  });
});

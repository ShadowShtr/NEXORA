import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

// NEX-152: "Manifest e instalação PWA — ícones, standalone, theme." Guards the fields
// that matter for installability and against re-introducing the stale pre-NEX-150
// theme colour (the manifest and icons both used the old --pink-500, #d95f93, before
// its AA fix).
describe('PWA manifest', () => {
  const result = manifest();

  it('is installable as a standalone app', () => {
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
  });

  it('uses the current design-system tokens, not the stale pre-NEX-150 colour', () => {
    expect(result.theme_color).toBe('#b24e79');
    expect(result.theme_color).not.toBe('#d95f93');
    expect(result.background_color).toBe('#fff8fb');
  });

  it('provides both a regular and a maskable icon at 512x512', () => {
    const icons = result.icons ?? [];
    const regular512 = icons.find((icon) => icon.sizes === '512x512' && !icon.purpose);
    const maskable512 = icons.find((icon) => icon.purpose === 'maskable');

    expect(regular512).toBeDefined();
    expect(maskable512).toBeDefined();
    expect(maskable512?.sizes).toBe('512x512');
  });
});

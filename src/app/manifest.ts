import type { MetadataRoute } from 'next';

// NEX-152: theme_color/background_color mirror the --pink-500/--pink-50 design tokens
// (see docs/DESIGN_SYSTEM.md) — kept as literal hex here since manifest.ts runs before
// any stylesheet loads and can't reference a CSS custom property.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEXORA',
    short_name: 'NEXORA',
    description: 'Agenda e gestão de marcações.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff8fb',
    theme_color: '#b24e79',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

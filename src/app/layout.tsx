import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'NEXORA', template: '%s · NEXORA' },
  description: 'Marcações simples para profissionais e clientes.',
  applicationName: 'NEXORA',
};

export const viewport: Viewport = {
  themeColor: '#d95f93',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { Inter, Poppins } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/features/shell/ServiceWorkerRegistration';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'NEXORA', template: '%s · NEXORA' },
  description: 'Marcações simples para profissionais e clientes.',
  applicationName: 'NEXORA',
  icons: {
    icon: '/icons/icon-512.png',
    apple: '/icons/apple-touch-icon.png',
  },
  // NEX-152: manifest.ts's `display: 'standalone'` is not honoured by iOS Safari at
  // all — "Adicionar ao Ecrã Principal" only behaves like a standalone app there when
  // these apple-specific tags are present.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NEXORA',
  },
};

export const viewport: Viewport = {
  themeColor: '#b24e79',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // NEX-164: reading a dynamic API (headers()) here is what lets Next.js detect the
  // per-request nonce src/proxy.ts set on the CSP response header and automatically
  // apply it to every script tag Next.js itself renders (its own runtime/hydration
  // scripts, and next/script usages like TurnstileWidget) — without this call
  // somewhere in the root layout, Next has no per-request context to thread a nonce
  // through at all. The nonce value itself isn't otherwise used here.
  await headers();

  return (
    <html lang="pt-PT" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}

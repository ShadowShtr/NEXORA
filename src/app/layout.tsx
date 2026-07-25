import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-PT" className={`${inter.variable} ${poppins.variable}`}>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}

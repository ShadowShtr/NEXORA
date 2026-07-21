import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Poppins } from 'next/font/google';
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
};

export const viewport: Viewport = {
  themeColor: '#d95f93',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-PT" className={`${inter.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

// docs/DESIGN_SYSTEM_PIXEL_PERFECT.md §6: Poppins para títulos/marca/botões, Inter para
// texto operacional/formulários/horários/valores — carregadas aqui uma única vez (versão
// fixa no lockfile via next/font/google) e expostas como variáveis CSS para o resto do
// sistema consumir por seletor, não por página.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: { default: 'NEXORA', template: '%s · NEXORA' },
  description: 'Marcações simples para profissionais e clientes.',
  applicationName: 'NEXORA',
};

export const viewport: Viewport = {
  themeColor: '#ff3f7f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-PT" className={`${poppins.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}

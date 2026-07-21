'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Calendar,
  Grid2x2,
  Home,
  Scissors,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { LogoutButton } from '@/features/auth/LogoutButton';

type NavItem = { href: Route; label: string; icon: LucideIcon };

// 01_PRODUCT_REQUIREMENTS.md #14 — mobile bottom bar: Início, Agenda, Clientes,
// Serviços, Mais (Mais é uma página própria, não um menu sobreposto — visual
// refinement mid-2026: abre /dashboard/mais, que por sua vez dá acesso a Lembretes,
// Financeiro, Relatórios e Definições). Desktop amplia em vez de duplicar a
// experiência (CLAUDE.md): continua a mostrar tudo diretamente, sem "Mais".
const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/dashboard/agenda', label: 'Agenda', icon: Calendar },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Scissors },
];

const MORE_ITEMS: NavItem[] = [
  { href: '/dashboard/lembretes', label: 'Lembretes', icon: Bell },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/dashboard/definicoes', label: 'Definições', icon: Settings },
];

const MORE_NAV_ITEM: NavItem = { href: '/dashboard/mais', label: 'Mais', icon: Grid2x2 };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar para o conteúdo
      </a>

      <nav className="desktop-nav" aria-label="Navegação principal">
        <p className="app-shell-brand">NEXORA</p>
        <ul>
          {[...PRIMARY_ITEMS, ...MORE_ITEMS].map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                <item.icon aria-hidden="true" size={18} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <LogoutButton />
      </nav>

      <main id="main-content" className="app-shell-content" tabIndex={-1}>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {[...PRIMARY_ITEMS, MORE_NAV_ITEM].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className="mobile-nav-item"
          >
            <item.icon aria-hidden="true" size={22} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

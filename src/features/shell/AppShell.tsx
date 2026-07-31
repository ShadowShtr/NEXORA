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
  Users2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { LogoutSection } from '@/features/shell/LogoutSection';
import { initials } from '@/lib/initials';
import { hasPermission, type TenantRole } from '@/lib/auth/permissions';

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

const TEAM_ITEM: NavItem = { href: '/dashboard/equipa', label: 'Equipa e recursos', icon: Users2 };

export function AppShell({
  children,
  displayName,
  role,
}: {
  children: ReactNode;
  displayName: string;
  role: string;
}) {
  const pathname = usePathname();
  const canManageTeam = hasPermission(role as TenantRole, 'manage_team');
  const moreItems = canManageTeam ? [TEAM_ITEM, ...MORE_ITEMS] : MORE_ITEMS;

  function isActive(href: string) {
    return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
  }

  // On mobile, Financeiro/Lembretes/Relatórios/Definições are only reachable through
  // the "Mais" page (no dedicated bottom-nav tab of their own), so "Mais" should read as
  // the active tab while visiting any of them or their own sub-pages (e.g.
  // /dashboard/financeiro/pendentes) — not just literally on /dashboard/mais itself.
  // Desktop is unaffected: there, each of MORE_ITEMS is its own direct sidebar link,
  // already highlighted individually via isActive(item.href).
  function isMoreActive() {
    return (
      pathname.startsWith('/dashboard/mais') ||
      moreItems.some((item) => pathname.startsWith(item.href))
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar para o conteúdo
      </a>

      <nav className="desktop-nav" aria-label="Navegação principal">
        <div className="desktop-nav-brand">
          <span className="desktop-nav-logo" aria-hidden="true">
            N
          </span>
          <p className="app-shell-brand">NEXORA</p>
        </div>

        <ul className="desktop-nav-list">
          {PRIMARY_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                <item.icon aria-hidden="true" size={19} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="desktop-nav-section-label">Gestão</p>
        <ul className="desktop-nav-list">
          {moreItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                <item.icon aria-hidden="true" size={19} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="desktop-nav-footer">
          <div className="desktop-nav-profile">
            <span className="desktop-nav-avatar" aria-hidden="true">
              {initials(displayName || '?')}
            </span>
            <span className="desktop-nav-profile-text">
              <span className="desktop-nav-profile-name">{displayName || 'Profissional'}</span>
              <span className="desktop-nav-profile-role">Proprietária</span>
            </span>
          </div>
          <LogoutSection />
        </div>
      </nav>

      <main id="main-content" className="app-shell-content" tabIndex={-1}>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {PRIMARY_ITEMS.map((item) => (
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
        <Link
          href={MORE_NAV_ITEM.href}
          aria-current={isMoreActive() ? 'page' : undefined}
          className="mobile-nav-item"
        >
          <MORE_NAV_ITEM.icon aria-hidden="true" size={22} />
          <span>{MORE_NAV_ITEM.label}</span>
        </Link>
      </nav>
    </div>
  );
}

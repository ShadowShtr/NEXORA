'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
// Serviços, Mais (Mais contém Financeiro, Relatórios, Definições, Terminar sessão).
// Desktop amplia em vez de duplicar (CLAUDE.md): mostra tudo diretamente, sem "Mais".
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!morePanelRef.current?.contains(target) && !moreButtonRef.current?.contains(target)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [moreOpen]);

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
        <button
          ref={moreButtonRef}
          type="button"
          className="mobile-nav-item"
          aria-expanded={moreOpen}
          aria-controls="mobile-nav-more"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Grid2x2 aria-hidden="true" size={22} />
          <span>Mais</span>
        </button>
      </nav>

      {moreOpen ? (
        <div id="mobile-nav-more" ref={morePanelRef} className="mobile-nav-more">
          <nav aria-label="Mais opções">
            <ul>
              {MORE_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    onClick={() => setMoreOpen(false)}
                  >
                    <item.icon aria-hidden="true" size={18} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <LogoutButton />
        </div>
      ) : null}
    </div>
  );
}

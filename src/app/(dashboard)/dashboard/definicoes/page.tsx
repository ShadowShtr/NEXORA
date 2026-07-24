import Link from 'next/link';
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Database,
  Palette,
  Wallet,
} from 'lucide-react';

// NEX-140: "Central de definições em cartões — negócio, agenda, marcações, lembretes,
// pagamentos, aparência, dados." A hub of navigation cards, one per category, each
// linking to its own subpage — the categories that already had a form (agenda,
// marcações, lembretes, aparência) keep it, just relocated; the categories that don't
// (negócio, pagamentos, dados) show a short "em breve" placeholder rather than a form
// invented for this task (não expandir o escopo). Deliberately kept to server-rendered
// links, no client JS, so this and the a11y sweep in definicoes-hub.spec.ts stay simple.
const CATEGORIES = [
  {
    href: '/dashboard/definicoes/negocio',
    icon: Building2,
    label: 'Negócio',
    description: 'Nome, contacto e morada.',
  },
  {
    href: '/dashboard/definicoes/agenda',
    icon: CalendarClock,
    label: 'Agenda',
    description: 'Bloqueios e horários especiais.',
  },
  {
    href: '/dashboard/definicoes/marcacoes',
    icon: ClipboardCheck,
    label: 'Marcações',
    description: 'Política de faltas.',
  },
  {
    href: '/dashboard/definicoes/lembretes',
    icon: Bell,
    label: 'Lembretes',
    description: 'Mensagem enviada às clientes.',
  },
  {
    href: '/dashboard/definicoes/pagamentos',
    icon: Wallet,
    label: 'Pagamentos',
    description: 'Métodos aceites.',
  },
  {
    href: '/dashboard/definicoes/aparencia',
    icon: Palette,
    label: 'Aparência',
    description: 'Perfil público, logótipo e capa.',
  },
  {
    href: '/dashboard/definicoes/dados',
    icon: Database,
    label: 'Dados',
    description: 'Exportações financeiras.',
  },
] as const;

export default function DefinicoesPage() {
  return (
    <div className="shell">
      <p className="text-eyebrow">Definições</p>
      <h1 className="text-title">Definições</h1>
      <ul className="settings-hub-grid">
        {CATEGORIES.map(({ href, icon: Icon, label, description }) => (
          <li key={href}>
            <Link href={href} className="settings-hub-card">
              <span className="settings-hub-card-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="settings-hub-card-body">
                <span className="settings-hub-card-label">{label}</span>
                <span className="settings-hub-card-description">{description}</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} className="settings-hub-card-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

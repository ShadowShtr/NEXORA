'use client';

import { clsx } from 'clsx';

export type TabItem = { value: string; label: string };

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: 'pill' | 'underline';
  'aria-label': string;
};

// docs/DESIGN_SYSTEM_PIXEL_PERFECT.md primitives — "pill" para filtros (ex.: categorias
// de serviços), "underline" para separadores de secção (ex.: Resumo/Histórico/Preferências
// na ficha da cliente). Não é navegação (sem mudança de URL) — cada consumidor decide se
// o valor do tab também deve refletir na querystring.
export function Tabs({ items, value, onChange, variant = 'pill', ...props }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={props['aria-label']}
      className={clsx('nx-tabs', variant === 'pill' ? 'nx-tabs-pill' : 'nx-tabs-underline')}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          className="nx-tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

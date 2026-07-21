import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export function MoreMenuItem({
  href,
  icon: Icon,
  label,
  description,
  badge,
}: {
  href: Route;
  icon: LucideIcon;
  label: string;
  description?: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="more-menu-item">
      <span className="more-menu-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <span className="more-menu-text">
        <span className="more-menu-label">{label}</span>
        {description ? <span className="more-menu-description">{description}</span> : null}
      </span>
      {badge && badge > 0 ? (
        <span className="more-menu-badge">{badge > 99 ? '99+' : badge}</span>
      ) : null}
      <ChevronRight aria-hidden="true" className="more-menu-chevron" size={18} />
    </Link>
  );
}

export function MoreSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className="more-section-title">{title}</p>
      <div className="more-section-card">{children}</div>
    </>
  );
}

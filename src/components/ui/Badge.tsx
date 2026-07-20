import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return <span className={clsx('nx-badge', `nx-badge-${variant}`, className)} {...props} />;
}

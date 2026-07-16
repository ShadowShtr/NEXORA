import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export function Button({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={clsx('button', className)} {...props} />;
}

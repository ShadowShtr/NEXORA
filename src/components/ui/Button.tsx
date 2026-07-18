import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ className, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx('button', variant === 'secondary' && 'button-secondary', className)}
      {...props}
    />
  );
}

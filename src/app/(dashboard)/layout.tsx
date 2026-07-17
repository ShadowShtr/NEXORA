import type { ReactNode } from 'react';
import { requireProfile } from '@/lib/auth/require-profile';
import { AppShell } from '@/features/shell/AppShell';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireProfile();

  return <AppShell>{children}</AppShell>;
}

import type { ReactNode } from 'react';
import { requireProfile } from '@/lib/auth/require-profile';
import { AppShell } from '@/features/shell/AppShell';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { displayName } = await requireProfile();

  return <AppShell displayName={displayName}>{children}</AppShell>;
}

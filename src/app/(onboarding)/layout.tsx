import type { ReactNode } from 'react';
import { requireProfile } from '@/lib/auth/require-profile';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireProfile();

  return <>{children}</>;
}

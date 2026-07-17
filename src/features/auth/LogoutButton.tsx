import { Button } from '@/components/ui/Button';
import { logout } from '@/features/auth/actions';

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit">Sair</Button>
    </form>
  );
}

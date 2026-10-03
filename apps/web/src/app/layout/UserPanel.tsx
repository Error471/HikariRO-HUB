import { useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { useLogout } from '@/features/auth/session';
import { DeleteDataDialog } from '@/features/privacy/DeleteDataDialog';

export function UserPanel({ username }: { username: string }) {
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Has cerrado sesión.');
        void navigate({ to: '/login' });
      },
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-night-800/60 p-2.5">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-mana-600/60 to-night-600 font-display text-sm font-bold text-ink"
      >
        {username.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{username}</p>
        <p className="text-xs text-ink-faint">Cuenta de HikariRO</p>
      </div>
      <DeleteDataDialog />
      <button
        type="button"
        onClick={handleLogout}
        disabled={logout.isPending}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="grid size-10 place-items-center rounded-lg text-ink-muted transition hover:bg-white/5 hover:text-ember-400 disabled:opacity-60"
      >
        {logout.isPending ? <Spinner /> : <LogOut aria-hidden="true" className="size-4.5" />}
      </button>
    </div>
  );
}

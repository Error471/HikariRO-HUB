import { loginRequestSchema } from '@hrc/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Eye, EyeOff, Hourglass, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Brand } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useLogin } from './session';

interface LoginPageProps {
  redirectTo?: string;
  reason?: 'expired';
}

const inputClass =
  'block min-h-12 w-full rounded-xl border border-white/10 bg-night-950/60 px-4 text-base text-ink placeholder:text-ink-faint transition focus:border-gold-400/60 focus:outline-none focus:ring-2 focus:ring-gold-400/25 sm:text-sm';

export function LoginPage({ redirectTo, reason }: LoginPageProps) {
  const navigate = useNavigate();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const userId = useId();
  const passwordId = useId();
  const errorId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginRequestSchema.safeParse({
      username: form.get('username'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }
    setValidationError(null);
    login.mutate(parsed.data, {
      onSuccess: () => void navigate({ href: safeRedirect(redirectTo), replace: true }),
    });
  };

  const error = validationError ?? (login.isError ? errorMessage(login.error) : null);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-white/6 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_28rem_at_30%_35%,rgb(231_183_95/0.16),transparent_65%),radial-gradient(30rem_24rem_at_80%_90%,rgb(124_198_255/0.12),transparent_60%)]"
        />
        <Brand />
        <div className="relative max-w-lg animate-rise">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-gold-400/80">
            Rune-Midgard te espera
          </p>
          <h1 className="font-display text-5xl leading-tight font-bold text-balance">
            Tu centro de control de <span className="text-gold-300">HikariRO</span>
          </h1>
          <p className="mt-5 text-lg text-ink-muted">
            MVPs, mercados, noticias, wiki y tus álbumes de colección en un solo lugar.
          </p>
        </div>
        <p className="relative text-xs text-ink-faint">
          Proyecto de la comunidad. No afiliado oficialmente a HikariRO.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h2 className="font-display text-2xl font-bold">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Usa las credenciales de tu cuenta de HikariRO.
          </p>

          {reason === 'expired' && !error && (
            <p
              role="status"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-gold-400/25 bg-gold-400/8 p-3 text-sm text-gold-200"
            >
              <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Tu sesión ha expirado. Vuelve a iniciar sesión.
            </p>
          )}

          {error && (
            <p
              id={errorId}
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-ember-400/30 bg-ember-400/8 p-3 text-sm text-ember-400"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor={userId} className="mb-1.5 block text-sm font-medium">
                Usuario
              </label>
              <input
                id={userId}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={32}
                aria-describedby={error ? errorId : undefined}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="mb-1.5 block text-sm font-medium">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={64}
                  aria-describedby={error ? errorId : undefined}
                  className={cn(inputClass, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-ink-faint hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4.5" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4.5" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="mt-2 w-full" disabled={login.isPending}>
              {login.isPending ? (
                <Spinner />
              ) : (
                <LockKeyhole aria-hidden="true" className="size-4" />
              )}
              {login.isPending ? 'Conectando con HikariRO…' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-leaf-400/80" />
            El Companion envía tu contraseña por HTTPS a HikariRO solo para iniciar sesión. No la
            almacena ni la registra.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
            <Link to="/privacidad" className="text-mana-400 underline-offset-2 hover:underline">
              Privacidad y cómo funciona
            </Link>
            <span>
              ¿Sin cuenta?{' '}
              <a
                href="https://hikariro.com/?module=account&action=create"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mana-400 underline-offset-2 hover:underline"
              >
                Créala en HikariRO
              </a>
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

/** Solo se permiten redirecciones internas para evitar open redirects. */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/';
  }
  return target === '/login' ? '/' : target;
}

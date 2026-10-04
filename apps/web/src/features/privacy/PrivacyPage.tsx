import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from '@/components/ui/Brand';
import { publicInfoQuery } from './public-info';

const stored: { what: string; why: string; until: string }[] = [
  {
    what: 'Tu nombre de usuario de HikariRO',
    why: 'Asociar tus favoritos y avisos a tu cuenta.',
    until: 'Hasta que borres tus datos.',
  },
  {
    what: 'La sesión de HikariRO (cookie), cifrada con AES-256 y con una clave protegida por Windows',
    why: 'Consultar en tu nombre el MVP Timer, los álbumes y los mercados sin pedirte la contraseña cada vez.',
    until: 'Hasta que cierres sesión o HikariRO la dé por caducada.',
  },
  {
    what: 'Tu contraseña, solo si marcas «Mantener la sesión iniciada en este PC», cifrada con AES-256 y una clave protegida por Windows',
    why: 'Volver a entrar sola cuando HikariRO cierra la sesión (por ejemplo, tras apagar o suspender el PC).',
    until: 'Hasta que cierres sesión o borres tus datos.',
  },
  {
    what: 'Tus MVPs favoritos y la configuración de los avisos',
    why: 'Mostrártelos y avisarte de ellos.',
    until: 'Hasta que los quites o borres tus datos.',
  },
  {
    what: 'Marcas de avisos ya mostrados',
    why: 'No avisarte dos veces de lo mismo.',
    until: '24 h; se borran solas.',
  },
  {
    what: 'Copias temporales de lo que muestra HikariRO (MVPs, mercados, álbumes, wiki, noticias)',
    why: 'Que la app sea rápida y no sobrecargar HikariRO.',
    until: 'Entre 10 s y 30 min, en memoria; desaparecen al cerrar la app.',
  },
];

const notStored = [
  'Tu contraseña, si no marcas «Mantener la sesión iniciada»: viaja cifrada (HTTPS) desde tu PC hasta HikariRO solo para iniciar sesión y no se guarda. Nunca se registra.',
  'Datos de pago, correo o datos personales de tu cuenta.',
  'Analítica, publicidad ni cookies de terceros.',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold text-gold-200">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

/** Página pública: qué guarda Hikari Hub, qué no y cómo borrar los datos. */
export function PrivacyPage({ authenticated }: { authenticated: boolean }) {
  const info = useQuery(publicInfoQuery);
  const contact = info.data?.privacyContact;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <Link
          to={authenticated ? '/' : '/login'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {authenticated ? 'Volver a la app' : 'Volver al inicio de sesión'}
        </Link>
      </header>

      <div className="flex flex-col gap-3 animate-rise">
        <p className="text-sm font-medium text-ink-faint">Privacidad</p>
        <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
          Privacidad y cómo funciona
        </h1>
        <p className="text-ink-muted">
          Hikari Hub es una app no oficial creada por jugadores. No está afiliada a HikariRO. Aquí
          se explica qué datos guarda, para qué y cómo borrarlos.
        </p>
      </div>

      <Section title="Cómo funciona">
        <p>
          Hikari Hub no tiene cuentas propias ni servidores: entras con tu usuario y contraseña de
          HikariRO y la app, que se ejecuta en tu PC, inicia sesión en HikariRO por ti. A partir de
          ahí consulta en tu nombre las mismas páginas que verías en la web (MVP Timer, álbumes,
          mercados…) para mostrarlas aquí.
        </p>
        <p>
          Todo lo que guarda se queda en tu PC, en la carpeta de datos de Hikari Hub de tu usuario
          de Windows. Nadie más, tampoco quien creó la app, puede verlo.
        </p>
      </Section>

      <Section title="Qué guardamos">
        <ul className="flex flex-col gap-3">
          {stored.map((item) => (
            <li key={item.what} className="rounded-xl border border-white/8 bg-night-850/70 p-4">
              <p className="flex items-start gap-2 font-medium text-ink">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-leaf-400" />
                {item.what}
              </p>
              <dl className="mt-2 grid gap-1 pl-6 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="text-ink-faint">Para qué</dt>
                <dd>{item.why}</dd>
                <dt className="text-ink-faint">Hasta cuándo</dt>
                <dd>{item.until}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Qué no guardamos">
        <ul className="flex flex-col gap-2">
          {notStored.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ember-400" />
              {item}
            </li>
          ))}
        </ul>
        <p>
          La app guarda en tu PC un registro de errores técnicos para poder diagnosticarlos. Nunca
          incluye contraseñas ni cookies.
        </p>
      </Section>

      <Section title="Con quién se comparten">
        <p>
          Solo con <strong className="text-ink">HikariRO</strong>, para iniciar sesión y consultar
          tus datos. La app también consulta GitHub para saber si hay una versión nueva, sin enviar
          ningún dato tuyo. Los avisos de MVP los muestra Windows en tu propio PC.
        </p>
      </Section>

      <Section title="Cómo borrar tus datos">
        <p>
          En el panel de usuario (abajo en la barra lateral) pulsa{' '}
          <strong className="text-ink">Borrar mis datos</strong>. Se eliminan al momento tus
          favoritos, tus avisos y la sesión guardada, y se cierra tu sesión en HikariRO.
        </p>
        <p>
          Al desinstalar Hikari Hub desde la configuración de Windows se borra también toda su
          carpeta de datos.
        </p>
      </Section>

      {contact && (
        <Section title="Contacto">
          <p>
            Responsable de esta instancia: <strong className="text-ink">{contact}</strong>
          </p>
        </Section>
      )}
    </div>
  );
}

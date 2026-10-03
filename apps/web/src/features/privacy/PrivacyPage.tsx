import { publicInfoSchema } from '@hrc/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from '@/components/ui/Brand';
import { apiRequest } from '@/lib/api-client';

const stored: { what: string; why: string; until: string }[] = [
  {
    what: 'Tu nombre de usuario de HikariRO',
    why: 'Asociar tus favoritos y avisos a tu cuenta.',
    until: 'Hasta que borres tus datos.',
  },
  {
    what: 'La sesión de HikariRO (cookie), cifrada con AES-256',
    why: 'Consultar en tu nombre el MVP Timer, los álbumes y los mercados.',
    until: 'Hasta que cierres sesión o pasen 48 h sin usar la app.',
  },
  {
    what: 'Tus MVPs favoritos',
    why: 'Verlos en todos tus dispositivos y avisarte de ellos.',
    until: 'Hasta que los quites o borres tus datos.',
  },
  {
    what: 'Dispositivos con avisos activados (dirección del servicio de notificaciones del navegador y sus claves de cifrado) y la antelación elegida',
    why: 'Enviarte los avisos de MVP.',
    until: 'Hasta que desactives los avisos o borres tus datos.',
  },
  {
    what: 'Marcas de avisos ya enviados',
    why: 'No mandarte el mismo aviso dos veces.',
    until: '24 h; se borran solas.',
  },
  {
    what: 'Copias temporales de lo que muestra HikariRO (MVPs, mercados, álbumes, wiki, noticias)',
    why: 'Que la app sea rápida y no sobrecargar HikariRO.',
    until: 'Entre 10 s y 30 min, en memoria.',
  },
];

const notStored = [
  'Tu contraseña: viaja cifrada (HTTPS) hasta HikariRO solo para iniciar sesión y no se guarda ni se registra.',
  'Datos de pago, correo o datos personales de tu cuenta.',
  'Analítica, publicidad ni cookies de terceros.',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold text-gold-200">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

/** Página pública: qué guarda el Companion, qué no y cómo borrar los datos. */
export function PrivacyPage({ authenticated }: { authenticated: boolean }) {
  const info = useQuery({
    queryKey: ['public-info'],
    queryFn: ({ signal }) => apiRequest('/info', { schema: publicInfoSchema, signal }),
    staleTime: Infinity,
  });
  const contact = info.data?.privacyContact;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <Link
          to={authenticated ? '/' : '/login'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-gold-400/40 hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {authenticated ? 'Volver a la app' : 'Volver al inicio de sesión'}
        </Link>
      </header>

      <div className="flex flex-col gap-3 animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400/80">
          Privacidad
        </p>
        <h1 className="font-display text-3xl font-bold text-balance sm:text-4xl">
          Privacidad y cómo funciona
        </h1>
        <p className="text-ink-muted">
          HikariRO Companion es una app no oficial creada por jugadores. No está afiliada a
          HikariRO. Aquí se explica qué datos guarda, para qué y cómo borrarlos.
        </p>
      </div>

      <Section title="Cómo funciona">
        <p>
          El Companion no tiene cuentas propias: entras con tu usuario y contraseña de HikariRO. El
          servidor del Companion inicia sesión en HikariRO por ti y, a partir de ahí, consulta en tu
          nombre las mismas páginas que verías en la web (MVP Timer, álbumes, mercados…) para
          mostrarlas aquí.
        </p>
        <p>
          Tu navegador nunca recibe la sesión de HikariRO: solo una cookie técnica propia (
          <code className="text-ink">__Host-hrc_sid</code>) que identifica tu sesión en el
          Companion. No hay cookies de publicidad ni de seguimiento.
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
              <dl className="mt-2 grid gap-1 pl-6 sm:grid-cols-[7rem_1fr]">
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
          Los registros técnicos del servidor pueden incluir tu dirección IP y las páginas
          solicitadas, para detectar errores y abusos. Nunca incluyen contraseñas ni cookies.
        </p>
      </Section>

      <Section title="Con quién se comparten">
        <p>
          Con <strong className="text-ink">HikariRO</strong>, para iniciar sesión y consultar tus
          datos. Si activas los avisos, el servicio de notificaciones de tu navegador (Google,
          Mozilla, Apple o Microsoft) entrega los avisos cifrados. Con nadie más.
        </p>
      </Section>

      <Section title="Cómo borrar tus datos">
        <p>
          En el panel de usuario (abajo en la barra lateral; en el móvil, menú{' '}
          <strong className="text-ink">Más</strong>) pulsa{' '}
          <strong className="text-ink">Borrar mis datos</strong>. Se eliminan al momento tus
          favoritos, tus dispositivos con avisos y la sesión de ese dispositivo, y se cierra tu
          sesión en HikariRO.
        </p>
        <p>
          Si tienes la sesión abierta en otros dispositivos, se cierra sola a las 48 h sin uso o
          cuando cierres sesión en ellos. Para dejar de recibir avisos en un solo dispositivo, usa{' '}
          <strong className="text-ink">MVP Timer → Avisos → Desactivar</strong>.
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

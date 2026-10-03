# HikariRO Companion

Companion web para jugadores de **HikariRO** (Ragnarok Online): MVP Timer, mercados, noticias, wiki y álbumes de colección en una sola aplicación, usando tu cuenta de HikariRO.

> Proyecto de la comunidad, no afiliado oficialmente a HikariRO.

## Estado

| Fase | Contenido                                                                                           | Estado   |
| ---- | --------------------------------------------------------------------------------------------------- | -------- |
| 1    | Arquitectura, monorepo, tema, layout, navegación, **login real contra FluxCP**, sesiones, dashboard | ✅ Hecho |
| 2    | MVP Timer + Noticias (ambos tienen endpoint JSON)                                                   | ✅ Hecho |
| 3    | Vending + Buying Store + búsqueda unificada                                                         | ✅ Hecho |
| 4    | Wiki (API MediaWiki)                                                                                | ✅ Hecho |
| 5    | Álbum de cartas + álbum de pesca                                                                    | ✅ Hecho |
| 6    | PWA, avisos push, favoritos sincronizados, tests e2e, CI/CD, despliegue gratuito                    | ✅ Hecho |

El análisis técnico de HikariRO (endpoints, sesión, riesgos) está en [`docs/01-analisis-tecnico-y-arquitectura.md`](docs/01-analisis-tecnico-y-arquitectura.md).

## Arquitectura

```text
Navegador ── SPA React (Vite)
   │  cookie propia __Host-hrc_sid (HttpOnly, Secure, SameSite=Strict) + cabecera x-csrf-token
   ▼
Caddy (HTTPS automático, cabeceras de seguridad, sirve la SPA)
   │  /api/*
   ▼
API Fastify (BFF) ── SessionStore (Redis) ── cookie de HikariRO cifrada con AES-256-GCM
   │
   ▼
HikariRO (FluxCP · JSON internos · MediaWiki)
```

- El navegador **nunca** habla directamente con HikariRO ni ve sus cookies.
- La contraseña solo existe en memoria durante la petición de login; no se guarda ni se registra.
- La API detecta la redirección de FluxCP al login y responde `SESSION_EXPIRED`; la web muestra _"Tu sesión ha expirado"_ y permite volver a entrar sin perder la ruta.

### Stack

| Capa         | Tecnología                                                                      | Motivo                                                                 |
| ------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo     | pnpm workspaces                                                                 | Esquemas y tipos compartidos (`@hrc/shared`)                           |
| Web          | React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Radix, Sonner, Lucide | App 100 % autenticada: SPA sin SSR; rutas tipadas, cache, lazy loading |
| API          | Fastify 5, undici, cheerio, Zod                                                 | BFF rápido, validación en los bordes, parsers HTML ligeros             |
| Datos        | Redis con persistencia AOF (memoria en desarrollo)                              | Sesiones, rate limit, favoritos y suscripciones push; sin SQL          |
| PWA y avisos | vite-plugin-pwa (Workbox), Web Push (VAPID, `web-push`)                         | Instalable en móvil y avisos con la app cerrada                        |
| Calidad      | TypeScript estricto, ESLint, Prettier, Vitest, Playwright                       | Tests unitarios, de rutas y e2e en escritorio y móvil                  |
| Deploy       | Docker Compose + Caddy, GitHub Actions                                          | Una VM gratuita (Oracle Always Free) es suficiente                     |

### Estructura

```text
apps/
  api/                  API Fastify
    src/config/         variables de entorno validadas
    src/hikari/         cliente HTTP de HikariRO + parsers de FluxCP
    src/session/        SessionStore (memoria / Redis) y servicio de sesiones
    src/plugins/        seguridad, errores, guardia de sesión + CSRF
    src/modules/        auth, health, mvp, news, markets, wiki, albums, push
    src/user/           datos propios por cuenta (favoritos, avisos)
    scripts/            mock de HikariRO para desarrollar sin conexión
    test/               tests y fixtures HTML
  web/                  SPA React
    src/app/            router, navegación, layout (sidebar, navegación móvil)
    src/features/       auth, dashboard, módulos, avisos, PWA
    src/sw.ts           service worker (precache + push)
    src/components/ui/  componentes reutilizables
    src/lib/            cliente de la API, React Query, utilidades
packages/shared/        esquemas Zod y tipos compartidos
docker/                 Dockerfiles y Caddyfile
e2e/                    tests end-to-end (Playwright)
docs/                   análisis técnico, estado y guía de despliegue
```

### Endpoints de la API

| Método | Ruta               | Descripción                                                                         |
| ------ | ------------------ | ----------------------------------------------------------------------------------- |
| `GET`  | `/api/health`      | Estado del servicio                                                                 |
| `GET`  | `/api/info`        | Información pública de la instancia (contacto de privacidad)                        |
| `POST` | `/api/auth/login`  | `{ username, password }` → inicia sesión en HikariRO y crea la sesión del Companion |
| `GET`  | `/api/auth/me`     | Usuario actual + token CSRF. Revalida contra HikariRO cada 5 min                    |
| `POST` | `/api/auth/logout` | Cierra sesión en HikariRO y en el Companion (requiere `x-csrf-token`)               |

Módulos (todos requieren sesión):

| Método   | Ruta                           | Descripción                                                                                   |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `GET`    | `/api/mvp`                     | MVPs con su estado, mapa y hora del servidor                                                  |
| `GET`    | `/api/news`                    | Noticias, eventos y changelog del Discord oficial                                             |
| `GET`    | `/api/markets/:type`           | Tiendas abiertas (`vending` o `buying`)                                                       |
| `GET`    | `/api/markets/:type/:shopId`   | Detalle de una tienda: objetos, precios y cantidades                                          |
| `GET`    | `/api/markets/search?q=`       | Búsqueda unificada de un objeto en ventas y compras                                           |
| `GET`    | `/api/wiki/page?title=`        | Artículo de la wiki con HTML saneado                                                          |
| `GET`    | `/api/wiki/search?q=`          | Búsqueda en la wiki                                                                           |
| `GET`    | `/api/wiki/categories[/:name]` | Categorías y sus artículos                                                                    |
| `GET`    | `/api/wiki/index`              | Portada e índice de la wiki                                                                   |
| `GET`    | `/api/albums/cards`            | Álbum de cartas. Query: `status` (`all`/`found`/`missing`), `sort` (`id`/`name`), `q`, `page` |
| `GET`    | `/api/albums/fishing`          | Álbum de pesca: progreso y especies (las no descubiertas sin nombre)                          |
| `GET`    | `/api/mvp/favorites`           | MVPs favoritos de la cuenta                                                                   |
| `PUT`    | `/api/mvp/favorites`           | `{ ids }` → guarda los favoritos (máx. 300)                                                   |
| `GET`    | `/api/push/config`             | Clave pública VAPID, antelación y dispositivos suscritos                                      |
| `POST`   | `/api/push/subscriptions`      | Suscribe este navegador (`PushSubscription.toJSON()`)                                         |
| `DELETE` | `/api/push/subscriptions`      | `{ endpoint }` → da de baja un dispositivo                                                    |
| `PUT`    | `/api/push/settings`           | `{ leadMinutes: 0 \| 5 \| 10 \| 15 }`                                                         |
| `POST`   | `/api/push/test`               | Envía un aviso de prueba a todos los dispositivos (3/min)                                     |

Errores siempre con el formato `{ "error": { "code", "message" } }` y mensajes aptos para el usuario.

## Requisitos

- Node.js 22+
- pnpm 10 (`corepack enable`)
- Redis 7 (solo en producción; en desarrollo se usa memoria)

## Instalación

```bash
corepack enable
pnpm install
cp .env.example .env
```

Rellena en `.env` los secretos (y, si quieres probar los avisos, las claves VAPID con `pnpm --filter @hrc/api vapid`):

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# SESSION_ENCRYPTION_KEY (32 bytes en base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Desarrollo

```bash
pnpm dev            # API en :3000 y web en http://localhost:5173 (Vite hace proxy de /api)
```

### Sin conexión con HikariRO

Hay un servidor que imita el login de FluxCP:

```bash
pnpm --filter @hrc/api mock:hikari    # http://localhost:4010 · usuario demo / contraseña demo
```

y en `.env`: `HIKARI_BASE_URL=http://localhost:4010`.

El mock también sirve el MVP Timer, mercados, wiki, álbumes (con sesión) y un feed de noticias; para el feed añade
`HIKARI_NEWS_FEED_URL=http://localhost:4010/discord/feed.php`.

### Módulos

- **MVP Timer**: misma lógica de estados que la web original (_Disponible_, _En espera_, _Respawn aleatorio_). La cuenta atrás se calcula en el navegador con la hora del servidor, y los datos se refrescan cada 15 s. Filtro guardado en la URL (`?filter=window`). Los favoritos se guardan en la cuenta (Redis) y se sincronizan entre dispositivos; los que hubiera en el navegador de versiones anteriores se migran solos.
- **Avisos de MVP**: Web Push con claves VAPID. Un proceso de la API consulta el MVP Timer cada `PUSH_POLL_SECONDS` por cada usuario con dispositivos suscritos y avisa de sus favoritos N minutos antes y al abrirse la ventana de respawn. Cada aviso se envía una sola vez (marca en Redis). Usa la sesión del usuario sin alargarla: si caduca, los avisos se pausan y se manda un aviso para volver a entrar. Al cerrar sesión se dejan de vigilar los respawns. En iPhone/iPad solo funcionan con la app añadida a la pantalla de inicio.
- **Privacidad**: página pública `/privacidad` (enlazada desde el login) con qué se guarda, qué no, con quién se comparte y cómo borrarlo; muestra `PRIVACY_CONTACT` si está definido. Botón **Borrar mis datos** (papelera en el panel de usuario): borra favoritos y avisos, cierra la sesión en el Companion y en HikariRO y da de baja los avisos del navegador.
- **PWA**: instalable (manifest, iconos, accesos directos). El service worker precachea la app (nunca la API) y avisa cuando hay una versión nueva.
- **Mercados**: HikariRO no tiene API de mercados y su búsqueda de items no es fiable, así que la API lee el listado y el detalle de cada tienda (máx. 3 peticiones simultáneas) y guarda una instantánea de 60 s compartida por todos los usuarios. Si HikariRO falla, se sirve la última instantánea durante 10 min. La búsqueda unificada ordena las ventas por precio ascendente y las compras por mejor oferta.
- **Wiki**: usa la API oficial de MediaWiki (no scraping). El HTML de cada artículo se sanea en la API con una lista blanca de etiquetas, atributos, clases (`mw-*`, `hro-*`, `wikitable`…) y propiedades CSS (sin `url()`, `position` ni `expression`). Los enlaces a artículos y categorías se convierten en rutas de la app, los externos se abren en otra pestaña y las imágenes usan URLs absolutas. El contenido no se modifica: se muestra sobre un fondo de pergamino porque los artículos traen estilos pensados para fondo claro.
- **Álbumes**: son páginas de FluxCP que solo existen con sesión, así que la API usa la cookie del usuario y lee el HTML. En **Cartas** la API reenvía a HikariRO los filtros, la búsqueda y la paginación (20 por página) en vez de descargar las ~74 páginas, y guarda cada combinación 5 min por usuario. HikariRO no da cantidades ni fecha de obtención, así que no se muestran. En **Pesca** el álbum es por cuenta; las especies sin descubrir se muestran sin nombre, igual que en HikariRO.
- **Noticias**: vienen del Discord oficial. Discord no tiene campo título, así que se usa la primera línea del post. El markdown de Discord se convierte en componentes React (nunca en HTML), y solo se muestran imágenes de `cdn.discordapp.com` / `media.discordapp.net`.

### Scripts

| Comando                             | Qué hace                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                          | API + web en modo desarrollo                                    |
| `pnpm test`                         | Tests de todos los paquetes                                     |
| `pnpm lint`                         | ESLint                                                          |
| `pnpm format` / `pnpm format:check` | Prettier                                                        |
| `pnpm typecheck`                    | TypeScript en todos los paquetes                                |
| `pnpm build`                        | Build de producción                                             |
| `pnpm test:e2e`                     | Tests e2e (Playwright, contra el mock y el build de producción) |
| `pnpm --filter @hrc/api vapid`      | Genera claves VAPID para los avisos                             |

## Producción

Build manual:

```bash
pnpm build
NODE_ENV=production REDIS_URL=redis://... node apps/api/dist/server.js
# Sirve apps/web/dist como estáticos y haz proxy de /api/* a la API (mismo origen).
```

En producción la API **exige** `REDIS_URL` y `COOKIE_SECURE=true`.

## Deployment

Guía paso a paso gratuita (GitHub + Oracle Cloud Always Free + DuckDNS): [`docs/03-despliegue-gratuito.md`](docs/03-despliegue-gratuito.md).

En cualquier servidor con Docker:

```bash
cp .env.example .env    # DOMAIN, APP_ORIGIN, secretos nuevos, COOKIE_SECURE=true y claves VAPID
docker compose up -d --build
docker compose logs -f api
```

Caddy obtiene el certificado HTTPS automáticamente. Redis y la API no exponen puertos al exterior.

La CI de GitHub Actions (`.github/workflows/ci.yml`) comprueba formato, lint, tipos, tests, build, e2e, auditoría y las imágenes Docker para ARM64. Opcionalmente despliega por SSH en cada push a `main`.

## Seguridad

- **HTTPS** obligatorio (Caddy + HSTS). Cookie de sesión `__Host-hrc_sid`: `HttpOnly`, `Secure`, `SameSite=Strict`, firmada y opaca.
- **CSRF**: comprobación de `Origin` en todos los métodos no seguros + token sincronizado (`x-csrf-token`) en rutas autenticadas.
- **XSS**: React escapa por defecto; CSP estricta en Caddy (`script-src 'self'`). El único HTML externo que se inserta (artículos de la wiki) se sanea en la API con lista blanca; las noticias se renderizan como componentes React, sin HTML.
- **Credenciales**: la contraseña nunca se almacena ni se registra; la cookie de HikariRO se guarda cifrada (AES-256-GCM) en Redis y nunca llega al navegador.
- **Rate limiting**: global (300/min por IP), login por IP y bloqueo por usuario tras `LOGIN_MAX_ATTEMPTS` fallos, para no provocar bloqueos en HikariRO.
- **Validación** con Zod en todas las entradas y salidas; límite de cuerpo de 16 KB.
- **Logs** con redacción de cookies, cabeceras de auth y contraseñas; errores genéricos al usuario sin stack traces.
- **SSRF**: el cliente de HikariRO solo acepta rutas relativas al host configurado.
- **Secretos** solo en `.env` (ignorado por Git) y en los secretos de GitHub Actions.
- **Avisos push**: el servidor solo envía a servicios de push conocidos (FCM, Mozilla, Apple, Windows) por HTTPS, para que un `endpoint` malicioso no sirva de SSRF. Máximo 10 dispositivos por cuenta; los anulados por el navegador se borran solos. El contenido del aviso no incluye datos de la cuenta.
- **Service worker**: no cachea `/api`, solo abre rutas del propio origen al pulsar un aviso y se sirve con `Cache-Control: no-cache`. CSP con `worker-src` y `manifest-src` `'self'`.
- **Dependencias**: `pnpm audit` limpio; override de `esbuild` para tsup (GHSA-g7r4-m6w7-qqqr).

### Limitaciones conocidas

- HikariRO no ofrece OAuth ni API: el login se hace en su nombre desde el servidor. Si HikariRO cambia su formulario de login, la API responde `UPSTREAM_CHANGED` y hay que actualizar el parser (`apps/api/src/hikari/fluxcp-pages.ts`).
- HikariRO está detrás de Cloudflare. Si bloquea las peticiones desde la IP del servidor, la API responde `UPSTREAM_BLOCKED`. **Compruébalo en el primer deploy** iniciando sesión con tu cuenta.
- La respuesta exacta de FluxCP a un login fallido no se verificó con credenciales reales; la API no depende de ella porque valida la sesión consultando `?module=account&action=view`.

## Tests

```bash
pnpm test
```

```bash
PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e   # opcional; si no, usa `pnpm exec playwright install chromium`
```

Cubren: avisos push (antelación, duplicados, sesión caducada, SSRF), favoritos, parsers de MVP, mercados, wiki y álbumes, cifrado de sesiones, cookie jar, parser del login de FluxCP, detección de sesión caducada, login correcto/incorrecto, bloqueo por intentos, CSRF, Cloudflare, HikariRO caído, cookies seguras, logout, cabeceras de seguridad, cliente de la API y redirecciones seguras.

Los e2e levantan el mock de HikariRO, la API y el build de producción de la web, y prueban en escritorio y móvil: login correcto e incorrecto, redirección, logout, todos los módulos, filtros del álbum en la URL, favoritos sincronizados entre navegadores, diálogo de avisos y manifest de la PWA.

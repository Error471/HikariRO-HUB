# Hikari Hub

App de escritorio para Windows para jugadores de **HikariRO** (Ragnarok Online): MVP Timer con avisos, mercados, noticias, wiki y álbumes de colección en una sola aplicación, usando tu cuenta de HikariRO.

> Proyecto de la comunidad, no afiliado oficialmente a HikariRO.

## Instalar (jugadores)

1. Abre la página **Releases** del repositorio en GitHub y descarga `Hikari-Hub-Setup-x.y.z.exe` de la última versión.
2. Ábrelo. Como el instalador no está firmado, Windows puede mostrar _"Windows protegió su PC"_: pulsa **Más información → Ejecutar de todos modos**.
3. Se instala sola (sin pedir permisos de administrador) y crea un acceso directo en el escritorio y en el menú Inicio.
4. Entra con tu usuario y contraseña de HikariRO. Marca **Mantener la sesión iniciada en este PC** si no quieres volver a escribirla cuando HikariRO cierre la sesión (por ejemplo, tras apagar o suspender el PC).

- Al cerrar la ventana, Hikari Hub sigue junto al reloj para avisarte de tus MVPs. Para cerrarla del todo: clic derecho en el icono → **Salir**.
- Desde ese mismo menú puedes hacer que se abra al iniciar Windows y buscar actualizaciones.
- Las versiones nuevas se descargan solas y se instalan al cerrar la app.
- Para desinstalarla: Configuración de Windows → Aplicaciones → Hikari Hub. Se borran también sus datos.

## Arquitectura

No hay servidores: todo se ejecuta en el PC de cada jugador. GitHub guarda el código, compila el instalador y lo distribuye.

```text
Hikari Hub (Electron)
├── Ventana ── web React (la misma SPA de siempre)
│      │  cookie propia hh_sid (HttpOnly, SameSite=Strict) + cabecera x-csrf-token
│      ▼
├── API Fastify en 127.0.0.1 ── sesiones, favoritos y avisos en %APPDATA%\Hikari Hub\data
│      │                        (cookie de HikariRO cifrada con AES-256-GCM; clave protegida por Windows)
│      ▼
│   HikariRO (FluxCP · JSON internos · MediaWiki), desde la IP de casa del jugador
│
├── Vigilante de MVPs ── notificaciones de Windows
├── Icono junto al reloj (abrir, abrir al iniciar Windows, actualizaciones, salir)
└── electron-updater ── GitHub Releases
```

- La contraseña viaja de tu PC a HikariRO y nunca se registra. Solo se guarda (cifrada) si el jugador marca _Mantener la sesión iniciada_.
- HikariRO borra su sesión tras un rato sin actividad. Mientras la app está abierta, visita la cuenta cada `KEEPALIVE_MINUTES` (5 min) para mantenerla viva. Si aun así caduca y hay contraseña guardada, la app vuelve a entrar sola y repite la petición; si no, pide iniciar sesión.
- La web nunca ve la cookie de HikariRO. La API detecta la redirección de FluxCP al login y responde `SESSION_EXPIRED`; la web muestra _"Tu sesión ha expirado"_ y permite volver a entrar sin perder la ruta.
- Cada jugador entra desde su propia IP, así que Cloudflare no ve todos los logins desde un mismo servidor.

### Stack

| Capa         | Tecnología                                                                      | Motivo                                                           |
| ------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Monorepo     | pnpm workspaces                                                                 | Esquemas y tipos compartidos (`@hikari-hub/shared`)              |
| Escritorio   | Electron, electron-builder (NSIS), electron-updater, esbuild                    | App instalable con avisos nativos y actualizaciones desde GitHub |
| Web          | React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Radix, Sonner, Lucide | SPA rápida con rutas tipadas, cache y lazy loading               |
| API          | Fastify 5, undici, cheerio, Zod                                                 | Habla con HikariRO, valida en los bordes, parsers HTML ligeros   |
| Datos        | Archivos JSON en la carpeta de datos del usuario                                | Sesiones, favoritos y avisos: pocos datos, sin base de datos     |
| Calidad      | TypeScript estricto, ESLint, Prettier, Vitest, Playwright                       | Tests unitarios, de rutas y e2e                                  |
| Distribución | GitHub Actions + GitHub Releases                                                | Instalador compilado en Windows y publicado con un clic          |

### Estructura

```text
apps/
  desktop/              app de Electron
    src/main.ts         arranque: servidor local, ventana, bandeja, avisos, actualizaciones
    src/secrets.ts      claves de la instalación cifradas con safeStorage (DPAPI)
    build/              iconos del instalador y de la app
    electron-builder.yml
  api/                  API Fastify
    src/desktop.ts      arranque para la app de escritorio
    src/server.ts       arranque para desarrollo (pnpm dev)
    src/config/         variables de entorno validadas
    src/hikari/         cliente HTTP de HikariRO + parsers de FluxCP
    src/session/        sesiones (memoria / archivo)
    src/plugins/        seguridad, errores, guardia de sesión + CSRF, web estática
    src/modules/        auth, health, mvp, news, markets, wiki, albums, alerts, account
    src/user/           datos propios por cuenta (favoritos, avisos)
    scripts/            mock de HikariRO para desarrollar sin conexión
    test/               tests y fixtures HTML
  web/                  SPA React
    src/app/            router, navegación, layout
    src/features/       auth, dashboard, módulos, avisos, privacidad
    src/components/ui/  componentes reutilizables
    src/lib/            cliente de la API, React Query, utilidades
packages/shared/        esquemas Zod y tipos compartidos
e2e/                    tests end-to-end (Playwright)
docs/                   análisis técnico y sistema visual
```

### Endpoints de la API local

| Método | Ruta               | Descripción                                                                         |
| ------ | ------------------ | ----------------------------------------------------------------------------------- |
| `GET`  | `/api/health`      | Estado del servicio                                                                 |
| `GET`  | `/api/info`        | Información pública (contacto de privacidad, si se configura)                       |
| `POST` | `/api/auth/login`  | `{ username, password }` → inicia sesión en HikariRO y crea la sesión de Hikari Hub |
| `GET`  | `/api/auth/me`     | Usuario actual + token CSRF. Revalida contra HikariRO cada 5 min                    |
| `POST` | `/api/auth/logout` | Cierra sesión en HikariRO y en Hikari Hub (requiere `x-csrf-token`)                 |

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
| `GET`    | `/api/alerts/config`           | Si hay avisos disponibles (solo en la app), si están activos y la antelación                  |
| `PUT`    | `/api/alerts/settings`         | `{ enabled?, leadMinutes?: 0 \| 5 \| 10 \| 15 }`                                              |
| `POST`   | `/api/alerts/test`             | Muestra una notificación de prueba (3/min)                                                    |
| `DELETE` | `/api/account/data`            | Borra favoritos, avisos y la sesión, y cierra la sesión en HikariRO                           |

Errores siempre con el formato `{ "error": { "code", "message" } }` y mensajes aptos para el usuario. Cualquier otra ruta `GET` devuelve la web (`index.html`).

## Desarrollo

Requisitos: Node.js 22+ y pnpm 10 (`corepack enable`).

```bash
pnpm install
cp .env.example .env     # y rellena los dos secretos (ver el propio archivo)
```

### En el navegador (lo más rápido para tocar la web)

```bash
pnpm dev            # API en :3000 y web en http://localhost:5173 (Vite hace proxy de /api)
```

Los avisos de MVP solo funcionan en la app de escritorio; en el navegador el diálogo lo indica.

### La app de escritorio

```bash
pnpm --filter @hikari-hub/desktop start     # compila la web y abre la app (contra hikariro.com)
pnpm --filter @hikari-hub/desktop dist      # crea el instalador en apps/desktop/release (en Windows)
```

### Sin conexión con HikariRO

Hay un servidor que imita FluxCP (login, MVP Timer, mercados, wiki, álbumes y noticias):

```bash
pnpm --filter @hikari-hub/api mock:hikari    # http://localhost:4010 · usuario demo / contraseña demo
```

- Navegador: en `.env`, `HIKARI_BASE_URL=http://localhost:4010` y `HIKARI_NEWS_FEED_URL=http://localhost:4010/discord/feed.php`.
- App de escritorio (solo sin instalar): variables de entorno `HIKARI_HUB_HIKARI_URL` y `HIKARI_HUB_NEWS_URL` con esas mismas URLs.

### Scripts

| Comando                                   | Qué hace                                                           |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                | API + web en modo desarrollo                                       |
| `pnpm test`                               | Tests de todos los paquetes                                        |
| `pnpm lint`                               | ESLint                                                             |
| `pnpm format` / `pnpm format:check`       | Prettier                                                           |
| `pnpm typecheck`                          | TypeScript en todos los paquetes                                   |
| `pnpm build`                              | Build de la web y del proceso principal de la app                  |
| `pnpm test:e2e`                           | Tests e2e (Playwright, contra el mock y la web servida por la API) |
| `pnpm --filter @hikari-hub/desktop start` | Abre la app de escritorio sin instalarla                           |

## Publicar una versión nueva

Todo desde la web de GitHub:

1. Sube los cambios a la rama principal.
2. **Actions → Publicar versión → Run workflow**, escribe la versión nueva (por ejemplo `0.2.0`, siempre mayor que la anterior) y pulsa **Run workflow**.
3. GitHub pasa los tests, compila el instalador en Windows y crea la release `v0.2.0` con el `.exe`.
4. Las apps instaladas la descargan solas y se actualizan al cerrarse.

> El repositorio tiene que ser **público** para que otros jugadores puedan descargar el instalador y para que funcionen las actualizaciones automáticas. El código no contiene secretos: `.env` está en `.gitignore` y la app genera sus claves en cada PC.

### Módulos

- **MVP Timer**: misma lógica de estados que la web original (_Disponible_, _En espera_, _Respawn aleatorio_). La cuenta atrás se calcula con la hora del servidor y los datos se refrescan cada 15 s. Filtro guardado en la URL (`?filter=window`). Favoritos guardados por cuenta.
- **Avisos de MVP**: un vigilante dentro de la app consulta el MVP Timer cada `ALERT_POLL_SECONDS` (60 s) con la sesión del usuario y muestra una notificación de Windows N minutos antes y al abrirse la ventana de respawn de cada favorito. Cada aviso se muestra una sola vez. Si la sesión de HikariRO caduca, los avisos se pausan y se avisa para volver a entrar. Al pulsar la notificación se abre la app en el MVP Timer.
- **Privacidad**: página `/privacidad` (enlazada desde el login) con qué se guarda, qué no y cómo borrarlo. Botón **Borrar mis datos** en el panel de usuario.
- **Mercados**: HikariRO no tiene API de mercados y su búsqueda de items no es fiable, así que la API lee el listado y el detalle de cada tienda (máx. 3 peticiones simultáneas) y guarda una instantánea de 60 s. Si HikariRO falla, se sirve la última instantánea durante 10 min.
- **Wiki**: usa la API oficial de MediaWiki (no scraping). El HTML de cada artículo se sanea con una lista blanca de etiquetas, atributos, clases y propiedades CSS. Los enlaces internos se convierten en rutas de la app y los externos se abren en el navegador del sistema.
- **Álbumes**: páginas de FluxCP que solo existen con sesión; la API usa la cookie del usuario y lee el HTML. En **Cartas** reenvía a HikariRO filtros, búsqueda y paginación y guarda cada combinación 5 min. HikariRO no da cantidades ni fecha de obtención, así que no se muestran.
- **Noticias**: vienen del Discord oficial. El titular es la primera línea del post y el markdown se convierte en componentes React (nunca en HTML).

## Seguridad

- **Solo local**: la API escucha en `127.0.0.1` (puerto 47231 o siguientes); nada es accesible desde la red.
- **Ventana de Electron**: `contextIsolation`, `sandbox`, sin Node en la web, sin menú; los permisos del navegador (cámara, micrófono, ubicación…) se deniegan; los enlaces externos se abren en el navegador del sistema y solo si son `http(s)`; la ventana no puede navegar fuera de la app.
- **Sesiones**: cookie `hh_sid` `HttpOnly`, `SameSite=Strict`, firmada y opaca. La cookie de HikariRO se guarda cifrada (AES-256-GCM) y nunca llega a la web. Las claves se generan en cada instalación y se guardan cifradas por Windows (DPAPI, `safeStorage`).
- **CSRF**: comprobación de `Origin` en todos los métodos no seguros + token sincronizado (`x-csrf-token`) en rutas autenticadas.
- **XSS**: React escapa por defecto; CSP estricta (`script-src 'self'`). El único HTML externo (artículos de la wiki) se sanea con lista blanca; las noticias se renderizan como componentes React.
- **Credenciales**: la contraseña nunca se registra. Con _Mantener la sesión iniciada_ (solo en la app, opcional) se guarda cifrada con AES-256-GCM y una clave protegida por Windows, únicamente en ese PC; se borra al cerrar sesión o al borrar los datos. Si deja de ser válida, la sesión se cierra como siempre.
- **Rate limiting**: límite global en `/api` y bloqueo por usuario tras `LOGIN_MAX_ATTEMPTS` fallos, para no provocar bloqueos en HikariRO.
- **Validación** con Zod en todas las entradas y salidas; límite de cuerpo de 16 KB.
- **Logs** en `%APPDATA%\Hikari Hub\logs`, solo avisos y errores, con redacción de cookies, cabeceras y contraseñas; el archivo se vacía al pasar de 5 MB.
- **Archivos de datos**: escritura atómica y permisos solo para el usuario; si se dañan, se ignoran.
- **Secretos**: no hay secretos en el repositorio. En desarrollo van en `.env` (ignorado por Git); la publicación usa el `GITHUB_TOKEN` automático de Actions.

### Limitaciones conocidas

- HikariRO no ofrece OAuth ni API: la app inicia sesión en su nombre. Si HikariRO cambia su formulario de login, la API responde `UPSTREAM_CHANGED` y hay que actualizar el parser (`apps/api/src/hikari/fluxcp-pages.ts`).
- El instalador no está firmado: Windows SmartScreen avisa la primera vez. Firmarlo requiere un certificado de pago.
- Los avisos solo llegan mientras la app está abierta (aunque sea solo junto al reloj).
- Solo Windows. Para macOS o Linux habría que añadir sus objetivos en `electron-builder.yml`.

## Tests

```bash
pnpm test
PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e   # opcional; si no, usa `pnpm exec playwright install chromium`
```

Cubren: avisos (antelación, duplicados, sesión caducada, activar/desactivar, sin notificador), almacenes en archivo (reinicio, sesiones caducadas, archivo dañado), web servida por la API (caché, CSP, rutas de la SPA, límite de peticiones), claves cifradas de la instalación, navegación segura de la ventana, favoritos, parsers de MVP, mercados, wiki y álbumes, cifrado de sesiones, login correcto/incorrecto, bloqueo por intentos, CSRF, Cloudflare, HikariRO caído, logout y cabeceras de seguridad.

Los e2e levantan el mock de HikariRO y la API sirviendo el build de la web (como en la app) y prueban en ventana ancha y estrecha: login, redirección, logout, todos los módulos, filtros del álbum, favoritos, diálogo de avisos y borrado de datos.

# Hikari Hub

App de escritorio para Windows para jugadores de **HikariRO** (Ragnarok Online): MVP Timer con avisos, mercados, noticias, wiki y álbumes de colección en una sola aplicación, usando tu cuenta de HikariRO.


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

No hay servidores: todo se ejecuta en el PC. GitHub guarda el código, compila el instalador y lo distribuye.

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
- La web nunca ve la cookie de HikariRO. La API detecta la redirección de FluxCP al login y responde `SESSION_EXPIRED`; la web muestra _"Tu sesión ha expirado"_ y permite volver a entrar sin perder la ruta.

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

### Módulos

- **Dashboard**: tus MVPs (favoritos y con aviso) con cuenta atrás, completado con los próximos en salir; estado de los avisos (Windows/Telegram); progreso de los álbumes; últimas noticias; buscador del mercado y estado de HikariRO.
- **Búsqueda global (Ctrl+K / ⌘K)**: secciones, MVPs (por nombre o mapa), objetos del mercado con su mejor precio, páginas de la wiki y tus cartas, más atajos para buscar el texto en cada módulo. También desde el botón «Buscar…» del menú.
- **Cambios en la web de HikariRO**: cada servicio informa a un `UpstreamMonitor` del resultado de sus consultas. Si HikariRO responde con un formato que la app no reconoce (`UPSTREAM_CHANGED`, también cuando hay elementos en la página pero ninguno se entiende), la sección muestra «HikariRO ha cambiado su web» con enlace a la web oficial, aparece un aviso en toda la app y, en escritorio, una notificación de Windows (una vez por sección hasta que vuelva a funcionar).
- **Diagnóstico**: página `/diagnostico` con el estado de cada sección y los últimos 100 avisos/errores de la API (copiados desde el logger, sin tokens, contraseñas, cookies ni rutas de usuario) y botón «Copiar diagnóstico». No aparece en el menú: se llega desde el indicador de estado del dashboard, el aviso de cambios, los errores de cada sección o buscando «diagnóstico» con Ctrl+K.
- **MVP Timer**: misma lógica de estados que la web original (_Disponible_, _En espera_, _Respawn aleatorio_). La cuenta atrás se calcula con la hora del servidor y los datos se refrescan cada 15 s. Filtro guardado en la URL (`?filter=window`). Favoritos guardados por cuenta.
- **Avisos de MVP**: la campana de cada MVP elige el canal: **Windows**, **Telegram**, **ambos** o **ninguno** (filtro «Con avisos»). Un vigilante dentro de la app consulta el MVP Timer cada `ALERT_POLL_SECONDS` (60 s) con la sesión del usuario y avisa N minutos antes y al abrirse la ventana de respawn. Cada aviso se envía una sola vez; si Telegram falla, los avisos por Windows siguen llegando. Si la sesión de HikariRO caduca, los avisos se pausan y se avisa por los canales en uso. Al pulsar la notificación de Windows se abre la app en el MVP Timer. Los favoritos con avisos de versiones anteriores pasan a «Windows».
- **Telegram**: en «Avisos» se pega el token de un bot creado con @BotFather (se comprueba con `getMe` y se guarda cifrado con AES-256-GCM; nunca vuelve a la web), se pulsa Iniciar en el chat con el bot y «Detectar chat» lo vincula (`getUpdates`); también se puede escribir el ID de un grupo o canal. Los mensajes son texto plano, sin formato.
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

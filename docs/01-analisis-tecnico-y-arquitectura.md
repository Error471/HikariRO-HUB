# HikariRO Companion — Análisis técnico y propuesta de arquitectura

> Fecha del análisis: 03/10/2026 · Estado: **pendiente de aprobación** antes de empezar la Fase 1.

## 0. Cómo se ha hecho el análisis

- Las páginas se inspeccionaron desde un navegador real (DOM, scripts inline, `fetch` same-origin, `cookieStore`), con sesión iniciada y **sin sesión** (`credentials: 'omit'`) para distinguir qué requiere autenticación.
- **No se envió ningún formulario de login** (ni con credenciales reales ni falsas). Todo lo relativo a la respuesta del POST de login se marca como _no verificado_ y se basa en el comportamiento estándar de FluxCP.
- Las peticiones directas desde un servidor (curl) no fueron posibles desde el entorno de análisis, así que **no se ha podido comprobar cómo reacciona Cloudflare a peticiones server-side** (ver riesgo R2).

### Hallazgos generales

| Aspecto                          | Observado                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma                       | **FluxCP** (PHP 7.4, Apache 2.4 / Ubuntu) con tema propio `orange_themes` y componentes `hro-*` personalizados                                                  |
| CDN / WAF                        | **Cloudflare** (`server: cloudflare`)                                                                                                                           |
| Optimización                     | `mod_pagespeed` (scripts concatenados, imágenes inlineadas como `data:` base64)                                                                                 |
| API REST pública                 | **No existe.** Solo hay 2 endpoints JSON internos (MVP y noticias) + la API de MediaWiki                                                                        |
| CORS                             | Los endpoints JSON no son consumibles desde otro origen → **hace falta backend propio (BFF)**                                                                   |
| Cookie de sesión                 | `fluxSessionData` (ID de sesión PHP, 26 caracteres), `path=/`, `SameSite=Lax`, **sin `Secure` y sin `HttpOnly`** (legible desde JS), caducidad observada ≈ 48 h |
| robots.txt                       | No existe (404). Términos de uso sobre automatización: **no localizados**                                                                                       |
| Recursos estáticos reutilizables | `/data/items/icons/{id}.png`, `/data/items/images/{id}.png`, `/data/monsters/{id}.gif`                                                                          |

## 1. Tabla de análisis por módulo

| Módulo           | Método | Endpoint / Página                                                                                                  | Datos obtenidos                                                                                                                                                                                                                                      | Autenticación                           | AJAX/API                               | Dificultad                                              |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| **Login**        | `POST` | `/?module=account&action=login&return_url=`                                                                        | Campos: `server` (hidden, valor de 8 caracteres), `username`, `password`. Sin token CSRF. Sin captcha visible. Genera/usa cookie `fluxSessionData`                                                                                                   | —                                       | No (form HTML clásico)                 | **Media-alta** (credenciales pasan por nuestro backend) |
| **MVP Timer**    | `GET`  | `/?module=mvptimer&ajax=1`                                                                                         | JSON `{ ok, rows[], server_now }`. 98 filas (spawns). Cada fila: `id`, `name`, `map`, `killed_at`, `min_at`, `max_at`, `configured`, `now` (epoch s). La página original hace polling cada 15 s                                                      | **Sí** (sin sesión → redirect al login) | **Sí, JSON interno**                   | **Baja**                                                |
| **Vending**      | `GET`  | `/?module=vending` (lista) · `&action=viewshop&id=N` (detalle) · orden: `char_name_order`, `map_order`, `id_order` | Lista: id tienda, título, propietario, mapa, coordenadas. Detalle: item id, nombre, icono, precio unitario, nº artículos/unidades/valor total                                                                                                        | No (público)                            | No (HTML server-side)                  | **Media**                                               |
| **Buying Store** | `GET`  | `/?module=buyingstore` · `&action=viewshop&id=N`                                                                   | Igual que Vending; en detalle: cantidad (`x160`), oferta por unidad, oferta total                                                                                                                                                                    | No (público)                            | No (HTML server-side)                  | **Media**                                               |
| **Noticias**     | `GET`  | `https://api.hikariro.com/discord/feed.php` (leído del atributo `data-feed-url` de `/?module=main`)                | JSON `{ ok, updated_at, cached, stale, posts[] }`. Cada post: `id`, `section` (`noticias`/`changelog`/`eventos`), `author`, `content` (markdown de Discord), `created_at` (ISO), `image` (CDN Discord), `url` (enlace a Discord). 9 posts observados | No                                      | **Sí, JSON** (cache upstream 60–120 s) | **Baja**                                                |
| **Wiki**         | `GET`  | `/wiki/api.php` (MediaWiki **1.39.0** Action API) y `/wiki/rest.php/v1`                                            | `parse` (HTML + secciones + categorías), `search`, `allcategories`, `categorymembers`, `siteinfo`. 1.046 páginas, 14 artículos de contenido, 934 imágenes                                                                                            | No                                      | **Sí, API oficial MediaWiki**          | **Baja-media** (sanitizado + reescritura de enlaces)    |
| **Cartas**       | `GET`  | `/?module=cartaslog&p=N&status=all\|found\|missing&type_order=0&q=`                                                | Por carta: imagen, nombre, ID, estado _Obtenida/No obtenida_. Progreso global (p. ej. "275 de 1.468 · 18,73 %"). 20 por página, 74 páginas                                                                                                           | **Sí**                                  | No (HTML server-side, paginado)        | **Media**                                               |
| **Pesca**        | `GET`  | `/?module=fishingalbum`                                                                                            | Una sola página, 80 entradas. Descubiertos: imagen, nombre, estrellas, talla (cm), peso (kg), nº de capturas, un campo "Unknown". No descubiertos: "???" / "Not discovered". Cabecera "X / 80 discovered"                                            | **Sí**                                  | No (HTML server-side)                  | **Baja-media**                                          |

### Detalles y puntos no verificados por módulo

**Login**

- Cómo determina HikariRO que estás autenticado: sesión PHP asociada a `fluxSessionData`. Señales fiables observadas: (a) aparece el enlace `/?module=account&action=logout`; (b) `/?module=account&action=view` no redirige al login; (c) con sesión, la página de login muestra "No estás autorizado".
- Sin sesión, las páginas protegidas redirigen a `/?module=account&action=login&return_url=...` → **esta redirección es nuestra señal de "sesión expirada"**.
- _No verificado_: código HTTP y redirección exacta tras login correcto/incorrecto, mensaje de error, bloqueo tras N intentos fallidos, si aparece captcha tras fallos. Se validará en Fase 1 con la cuenta del usuario.

**MVP Timer**

- Estados calculables igual que la web original: _Disponible_ (sin `killed_at` o pasado `max_at`), _En espera_ (`now < min_at`), _Respawn aleatorio_ (`min_at ≤ now < max_at`).
- _No verificado_: si los datos son idénticos para todas las cuentas (parecen globales). Hasta comprobarlo, la cache será por usuario.

**Mercados**

- `/?module=vending&action=items` (búsqueda de items de FluxCP) existe pero devolvió _"No Items found"_ incluso para un item que sí estaba a la venta → **no es fiable**. En Buying Store la ruta equivalente da 404.
- Conclusión: la **búsqueda unificada se construye en nuestro backend** indexando las tiendas (lista + detalle de cada una). Con ~13 tiendas observadas son ~14–20 peticiones por ciclo; se hará en segundo plano, con concurrencia baja y cache de 60 s.
- Paginación: formato FluxCP ("Se han encontrado N registro(s) en M página(s)"), parámetro `p`. Solo se observó 1 página.

**Noticias**

- **No hay campo título.** El contenido es markdown de Discord; el titular se mostrará como la primera línea del post (normalmente en negrita). No se inventará un título.
- Las imágenes vienen del CDN de Discord; sus URLs pueden caducar, así que no se cachearán a largo plazo.

**Wiki**

- La API de MediaWiki permite construir una interfaz propia sin scraping: búsqueda, categorías, artículos y breadcrumbs. El HTML de `parse` se sanitiza en servidor y solo se reescriben enlaces internos a rutas de la app e imágenes a URLs absolutas; el contenido no se altera.

**Cartas**

- **No disponibles** en la fuente: cantidad de cada carta, fecha de obtención. No se mostrarán.
- `type_order=0` (orden por ID) verificado; el valor para "Nombre" se deduce de la UI y se confirmará.
- No hay selector de personaje → parece ser álbum **a nivel de cuenta** (no verificado).

**Pesca**

- Las estrellas y el campo "Unknown" no tienen significado documentado en la página; todas las especies descubiertas mostraban 5 estrellas. Se mostrarán tal cual, sin interpretarlos como "rareza" hasta confirmarlo.
- Textos de la fuente en inglés ("discovered", "catches").

## 2. Limitaciones y riesgos

| ID  | Riesgo                                                                                                                                                             | Impacto                                       | Mitigación propuesta                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Las credenciales pasan por nuestro servidor.** No hay OAuth ni API de tokens; la única integración posible es que el backend haga el login en nombre del usuario | Alto (confianza)                              | HTTPS obligatorio, la contraseña solo vive en memoria durante la petición, nunca se registra ni se guarda; logs con redacción. **Recomendado: hablar con el staff de HikariRO** (idealmente alojar en `companion.hikariro.com` o que expongan un endpoint de token) |
| R2  | **Cloudflare** puede bloquear o desafiar peticiones desde IPs de datacenter                                                                                        | Alto (bloqueante)                             | Verificarlo en la Fase 1 antes de seguir. Si ocurre: allowlist de nuestra IP por parte del staff                                                                                                                                                                    |
| R3  | Todos los logins salen de **una sola IP** → posibles bloqueos por intentos fallidos                                                                                | Medio                                         | Rate limiting propio estricto (por IP y por usuario) antes de tocar HikariRO                                                                                                                                                                                        |
| R4  | **Scraping frágil**: cambios en el HTML rompen parsers                                                                                                             | Medio                                         | Parsers aislados con tests de fixtures, validación con Zod, degradación controlada + enlace "Ver en HikariRO"                                                                                                                                                       |
| R5  | Términos de uso desconocidos                                                                                                                                       | Medio                                         | Consultar al staff; tráfico mínimo (cache, sin crawling agresivo), User-Agent identificable                                                                                                                                                                         |
| R6  | La cookie de HikariRO no es `HttpOnly` ni `Secure`                                                                                                                 | Bajo para nosotros (nunca llega al navegador) | Informar al staff como mejora de seguridad                                                                                                                                                                                                                          |

## 3. Arquitectura propuesta

Patrón **BFF (Backend-for-Frontend)**: el navegador solo habla con nuestra API; la API es la única que habla con HikariRO y guarda la sesión de FluxCP en servidor.

```text
Navegador (SPA React)
  │  cookie propia hrc_sid (HttpOnly, Secure, SameSite=Strict) + cabecera CSRF
  ▼
API Companion (Fastify, Node 22)
  ├── auth/        login, logout, me — sesiones propias
  ├── session/     SessionStore (memoria en dev, Redis en prod); guarda la cookie FluxCP cifrada (AES-256-GCM)
  ├── hikari/      HikariClient (undici): cookies, timeouts, reintentos, detección de "sesión expirada"
  │     └── parsers/ vending, buyingstore, cartas, pesca (cheerio + Zod)
  ├── modules/     mvp · markets (+ indexador) · news · wiki · albums
  └── cache/       LRU en memoria (Redis opcional para escalar)
  ▼
HikariRO: FluxCP (HTML + MVP JSON) · api.hikariro.com (noticias) · MediaWiki API
```

### Flujo de autenticación

1. Frontend → `POST /api/auth/login { username, password }` (rate-limited).
2. API → `GET` login de FluxCP (obtiene `fluxSessionData` y el valor de `server`) → `POST` con credenciales.
3. Verificación: `GET /?module=account&action=view` no redirige al login → éxito.
4. Se guarda en el SessionStore `{ fluxSession (cifrada), username, createdAt }`. **La contraseña se descarta.**
5. La API emite `hrc_sid` (ID aleatorio opaco) + token CSRF.
6. Cada llamada autenticada que reciba la redirección a login → la API borra la sesión y responde `401 SESSION_EXPIRED` → el frontend muestra "Tu sesión ha expirado · [Iniciar sesión nuevamente]".
7. Logout: llamada a `/?module=account&action=logout` en HikariRO + borrado de sesión + cookie.

### Stack y justificación

| Capa            | Elección                                                                           | Por qué                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo        | **pnpm workspaces**                                                                | Tipos y esquemas compartidos entre front y back sin duplicar                                                                                                             |
| Frontend        | **React 19 + Vite + TypeScript**                                                   | La app es 100 % autenticada: no necesita SSR/SEO, así que una SPA con Vite es más simple y rápida que Next.js                                                            |
| Routing / datos | **TanStack Router + TanStack Query**                                               | Rutas tipadas, lazy loading por módulo, cache, polling (MVP), reintentos y estados de carga de serie                                                                     |
| UI              | **Tailwind CSS v4 + Radix primitives** + Lucide (iconos) + Sonner (toasts)         | Tema dark fantasy propio con design tokens, accesible, sin aspecto de "admin genérico"                                                                                   |
| Backend         | **Fastify + TypeScript**                                                           | Rápido, validación con esquemas, plugins oficiales para cookies, CSRF, rate-limit, helmet                                                                                |
| Scraping        | **undici + cheerio**                                                               | HTTP rápido + parser HTML ligero (sin navegador headless)                                                                                                                |
| Validación      | **Zod** (en `packages/shared`)                                                     | Un único contrato de tipos para API y frontend                                                                                                                           |
| Sanitizado      | **sanitize-html** (servidor)                                                       | HTML de wiki y markdown de Discord sin XSS                                                                                                                               |
| Sesiones        | **Redis** en producción, memoria en desarrollo                                     | Sesiones de servidor revocables; también sirve de cache compartida                                                                                                       |
| Base de datos   | **Ninguna en Fases 1–5**                                                           | No hay datos propios que persistir: todo vive en HikariRO. Se añadirá PostgreSQL solo cuando lleguen favoritos/historial/notificaciones sincronizados entre dispositivos |
| Calidad         | ESLint, Prettier, Vitest, Playwright (e2e básico)                                  | —                                                                                                                                                                        |
| Deploy          | Docker Compose (web estática servida por Caddy con HTTPS automático + API + Redis) | Un VPS pequeño es suficiente                                                                                                                                             |

### Estructura de carpetas

```text
hikariro-companion/
├── apps/
│   ├── web/                     # SPA React
│   │   └── src/
│   │       ├── app/             # router, providers, layout (sidebar, mobile nav)
│   │       ├── features/        # auth, dashboard, mvp, markets, news, wiki, albums
│   │       ├── components/ui/   # botones, cards, skeletons, progreso...
│   │       ├── lib/             # cliente API, formatos, hooks
│   │       └── styles/          # tokens del tema
│   └── api/                     # Fastify
│       └── src/
│           ├── plugins/         # security, session, csrf, rate-limit, errors
│           ├── hikari/          # HikariClient + parsers + fixtures de test
│           ├── modules/         # auth, mvp, markets, news, wiki, albums (routes + service)
│           └── config/          # env validado con Zod
├── packages/shared/             # esquemas Zod y tipos compartidos
├── docker/  ·  docs/  ·  .env.example  ·  README.md
```

### Endpoints de la API

| Método | Ruta                                                                       | Auth | Cache servidor    | Fuente                              |
| ------ | -------------------------------------------------------------------------- | ---- | ----------------- | ----------------------------------- |
| POST   | `/api/auth/login`                                                          | —    | —                 | FluxCP login                        |
| POST   | `/api/auth/logout`                                                         | ✓    | —                 | FluxCP logout                       |
| GET    | `/api/auth/me`                                                             | ✓    | —                 | sesión propia                       |
| GET    | `/api/mvp`                                                                 | ✓    | 10 s              | `mvptimer&ajax=1`                   |
| GET    | `/api/markets/{vending\|buying}`                                           | ✓*   | 60 s              | lista HTML                          |
| GET    | `/api/markets/{vending\|buying}/:shopId`                                   | ✓*   | 60 s              | detalle HTML                        |
| GET    | `/api/markets/search?q=`                                                   | ✓*   | índice 60 s       | índice propio                       |
| GET    | `/api/news`                                                                | ✓*   | 60 s              | `api.hikariro.com/discord/feed.php` |
| GET    | `/api/wiki/search?q=` · `/page/:title` · `/categories` · `/category/:name` | ✓*   | 10 min            | MediaWiki API                       |
| GET    | `/api/albums/cards?page&status&q&sort`                                     | ✓    | 5 min por usuario | `cartaslog`                         |
| GET    | `/api/albums/fishing`                                                      | ✓    | 5 min por usuario | `fishingalbum`                      |

\* Públicos en HikariRO, pero dentro de la app se exige sesión para que todo el companion sea privado y nadie use la API como proxy abierto.

### Seguridad (resumen)

HTTPS (Caddy) + HSTS · cookie `hrc_sid` `HttpOnly; Secure; SameSite=Strict` · CSRF con token sincronizado + comprobación de `Origin` · CSP estricta (`img-src` limitado a hikariro.com y CDN de Discord) · sanitizado de todo HTML externo · validación Zod de entradas y salidas · rate limit (login: 5 intentos / 15 min por IP y por usuario) · cookie FluxCP cifrada en reposo, nunca enviada al navegador · logs con `pino` y redacción de `password`, cookies y cabeceras · secretos solo en `.env` (con `.env.example` en Git) · errores normalizados al usuario, sin stack traces.

### Rendimiento (resumen)

Lazy loading por ruta · TanStack Query con `staleTime` por módulo · cache en API alineada con la de HikariRO (MVP 10 s, noticias 60 s) · countdown del MVP calculado en cliente con offset del servidor (1 petición cada 15 s, no cada segundo) · indexador de mercados en segundo plano con concurrencia 2 · debounce 300 ms en búsquedas · skeletons y estados vacíos/error en todos los módulos · imágenes `loading="lazy"`.

## 4. Roadmap (ajustado tras el análisis)

| Fase  | Contenido                                                                                                                              | Motivo del orden                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **1** | Monorepo, config, tema visual, layout (sidebar + nav móvil), **login real contra FluxCP**, sesión, expiración, dashboard               | Valida primero los riesgos R1–R3 (login server-side y Cloudflare); si fallan, cambia la estrategia entera |
| **2** | **MVP Timer + Noticias**                                                                                                               | Ambos tienen JSON: valor alto con poco riesgo                                                             |
| **3** | **Vending + Buying Store** + búsqueda unificada                                                                                        | Requiere parsers HTML e indexador                                                                         |
| **4** | **Wiki**                                                                                                                               | API MediaWiki; el trabajo está en sanitizado, enlaces y navegación                                        |
| **5** | **Cartas + Pesca**                                                                                                                     | Parsers HTML con sesión, paginación y cache por usuario                                                   |
| **6** | PWA (instalable + notificaciones de MVP), tests e2e, hardening, Docker/deploy, y PostgreSQL solo si se activan favoritos sincronizados |

Cada fase termina con: código ejecutable, tests de parsers/servicios afectados y README actualizado.

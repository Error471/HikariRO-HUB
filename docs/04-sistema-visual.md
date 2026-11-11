# Sistema visual

Dirección: **RPG premium sobrio**, solo tema oscuro. Nombre: **Hikari Hub** (subtítulo "para HikariRO" donde haga falta aclararlo).

## Marca

- Símbolo: una **h** minúscula blanca con un **punto dorado** sobre la pata derecha (se lee también "hi", de _hikari_). Fondo grafito `#18181c` con radio 14/64.
- Logotipo: símbolo + "Hikari" y "Hub" en dorado cursiva, en Instrument Serif (como el logo de la web).
- Archivos: `apps/web/src/components/ui/Brand.tsx`, `apps/web/public/emblem.svg` y `apps/web/public/icons/*` (generados desde el mismo trazado).
- No usar el símbolo estirado, con otros colores de acento ni sobre fondos con poco contraste.

## Tokens (`apps/web/src/styles/index.css`)

| Token                           | Uso                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `night-950…600`                 | Superficies grafito neutras (fondo → elevado)                                                           |
| `ink`, `ink-muted`, `ink-faint` | Texto principal, secundario y terciario                                                                 |
| `gold-*`                        | **Único acento**: estado activo, acción principal, importes. No usarlo en bordes de hover ni decoración |
| `mana-*`, `ember-*`, `leaf-*`   | Solo semántica: en espera, ventana de respawn/error, disponible/ok                                      |
| `font-sans` / `font-display`    | Hanken Grotesk (texto, peso normal) / Instrument Serif (títulos)                                        |
| `font-mono`                     | Geist Mono (mapas, contadores)                                                                          |
| `rounded-card` (18 px)          | Tarjetas y paneles; botones, filtros y buscadores en píldora (`rounded-full`)                           |
| `surface`                       | Tarjeta: luz superior, filo interior, sombra suave y reflejo tenue que sigue al cursor (`useSpotlight`) |
| `.panel`                        | Panel flotante (menú lateral, diálogos, menús): como `surface`, con desenfoque de fondo                 |
| `.well`                         | Hueco interior hundido dentro de una superficie (filas de datos, retratos, panel de usuario)            |
| `.stagger`                      | Entrada escalonada de los hijos de una lista o rejilla                                                  |

## Estructura

- **Escritorio**: menú lateral **flotante** (panel redondeado separado del borde de la ventana) solo con navegación y usuario, y una **barra superior fija** con la búsqueda global (Ctrl+K), el estado de HikariRO y el enlace a la web oficial. Así están a mano en todas las pantallas, no solo en el dashboard.
- **Móvil**: barra superior con marca, búsqueda y menú; barra inferior de accesos rápidos.
- **Dashboard**: ilustración enmarcada en una tarjeta redondeada (`.hero-banner--compact`), cuatro cifras del MVP Timer que enlazan al timer ya filtrado (`MvpStats`) y debajo los widgets. Lo importante se ve sin desplazarse.
- **MVP Timer**: el estado se indica con la insignia, el color de la cuenta atrás y la barra de progreso (sin franjas de color en el borde de la tarjeta); la cuenta atrás es el dato más grande. En escritorio los filtros y la búsqueda se quedan fijos al desplazarse.

## Reglas

- **Profundidad, no decoración**: las superficies tienen capas (luz superior, filo interior, sombra) y el fondo una luz ambiente cálida muy tenue. Nada de franjas de color, brillos de neón ni degradados llamativos.
- Referencias de acabado: reactbits.dev, ui.aceternity.com, motionsites.ai y cosmos.so (paneles flotantes, huecos interiores, controles en píldora, botón principal con brillo sutil).
- Títulos en Instrument Serif (solo peso normal). `PageHeader` es compacto (título de 36–44 px) para dejar sitio al contenido; la etiqueta superior (`kicker`, con runa "ᚱ") solo da contexto de sección (p. ej. "Mercados", "Álbumes").
- Navegación, botones y filtros en **minúsculas de 14 px**: las mayúsculas espaciadas se reservan para etiquetas pequeñas (kicker, cabeceras de grupo y de tabla).
- Botones (`Button`): principal en dorado, secundario con borde neutro (`subtleButtonClass` para enlaces con el mismo aspecto), todos en píldora. El principal lleva degradado dorado suave y brillo interior.
- Filtros (`FilterTabs`): control segmentado en píldora dentro de un contenedor; la opción activa se marca con fondo y su contador en dorado.
- Hover: cambio de fondo o de borde neutro, sin desplazar elementos.
- Animaciones cortas (200–280 ms) y siempre con `prefers-reduced-motion`.
- Fondo con grano sutil; banner de la web en login y dashboard.
- La wiki sigue el mismo sistema (negro cálido, bordes finos color crema, Instrument Serif). Su copia local ya trae los colores de los artículos adaptados al tema oscuro, así que no hay fondo de pergamino. Avisos de página (`WikiNotice`): desactualizado/sistema antiguo en `ember`, en construcción en `mana`, evento antiguo en neutro.

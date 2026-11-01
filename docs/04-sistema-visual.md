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
| `font-sans` / `font-display`    | Hanken Grotesk (texto) / Instrument Serif (títulos)                                                          |
| `font-mono`                     | Geist Mono (mapas, contadores)                                                                          |
| `rounded-card` (12 px)          | Tarjetas y paneles; botones `rounded-xl`, chips `rounded-full`                                          |
| `.panel`                        | Panel elevado: borde blanco 7 %, sombra suave, sin degradados                                           |

## Reglas

- Sin degradados ni brillos decorativos; superficies planas con bordes finos.
- Títulos en Instrument Serif (solo peso normal); etiquetas, botones y navegación en mayúsculas espaciadas pequeñas, con runa "ᚱ" en los `kicker`. Botones y filtros en píldora; fondo con grano sutil y banner de la web en login y dashboard.
- `PageHeader` usa la etiqueta superior solo como contexto de sección (p. ej. "Mercados", "Álbumes").
- Hover: cambio de fondo o de borde neutro, sin desplazar elementos.
- Animaciones cortas (200–280 ms) y siempre con `prefers-reduced-motion`.
- La wiki sigue el mismo sistema (negro cálido, bordes finos color crema, Instrument Serif). Su copia local ya trae los colores de los artículos adaptados al tema oscuro, así que no hay fondo de pergamino. Avisos de página (`WikiNotice`): desactualizado/sistema antiguo en `ember`, en construcción en `mana`, evento antiguo en neutro.

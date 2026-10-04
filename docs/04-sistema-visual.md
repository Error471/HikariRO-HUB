# Sistema visual

Dirección: **RPG premium sobrio**, solo tema oscuro. Nombre: **Hikari Hub** (subtítulo "para HikariRO" donde haga falta aclararlo).

## Marca

- Símbolo: una **h** minúscula blanca con un **punto dorado** sobre la pata derecha (se lee también "hi", de _hikari_). Fondo grafito `#18181c` con radio 14/64.
- Logotipo: símbolo + "Hikari Hub" en Geist semibold con tracking ajustado.
- Archivos: `apps/web/src/components/ui/Brand.tsx`, `apps/web/public/emblem.svg` y `apps/web/public/icons/*` (generados desde el mismo trazado).
- No usar el símbolo estirado, con otros colores de acento ni sobre fondos con poco contraste.

## Tokens (`apps/web/src/styles/index.css`)

| Token                           | Uso                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `night-950…600`                 | Superficies grafito neutras (fondo → elevado)                                                           |
| `ink`, `ink-muted`, `ink-faint` | Texto principal, secundario y terciario                                                                 |
| `gold-*`                        | **Único acento**: estado activo, acción principal, importes. No usarlo en bordes de hover ni decoración |
| `mana-*`, `ember-*`, `leaf-*`   | Solo semántica: en espera, ventana de respawn/error, disponible/ok                                      |
| `font-sans` / `font-display`    | Geist Variable (todo el texto y los títulos)                                                            |
| `font-mono`                     | Geist Mono (mapas, contadores)                                                                          |
| `rounded-card` (12 px)          | Tarjetas y paneles; botones `rounded-xl`, chips `rounded-full`                                          |
| `.panel`                        | Panel elevado: borde blanco 7 %, sombra suave, sin degradados                                           |

## Reglas

- Sin degradados ni brillos decorativos; superficies planas con bordes finos.
- Títulos en Geist semibold con tracking ajustado; nada de mayúsculas espaciadas salvo etiquetas de grupo pequeñas.
- `PageHeader` usa la etiqueta superior solo como contexto de sección (p. ej. "Mercados", "Álbumes").
- Hover: cambio de fondo o de borde neutro, sin desplazar elementos.
- Animaciones cortas (200–280 ms) y siempre con `prefers-reduced-motion`.
- La wiki mantiene su fondo de pergamino porque los artículos traen estilos para fondo claro.

// Resume qué ha cambiado en wiki/pages.json respecto al último commit: lo usa la sincronización
// automática para el mensaje del commit. Uso: node apps/api/scripts/wiki-changes.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const byTitle = (json) => new Map(JSON.parse(json).pages.map((page) => [page.title, page.html]));

let before = new Map();
try {
  before = byTitle(
    execFileSync('git', ['show', 'HEAD:wiki/pages.json'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }),
  );
} catch {
  // Primera sincronización: todo cuenta como nuevo.
}
const after = byTitle(readFileSync(new URL('../../../wiki/pages.json', import.meta.url), 'utf8'));

const added = [...after.keys()].filter((title) => !before.has(title));
const removed = [...before.keys()].filter((title) => !after.has(title));
const changed = [...after.keys()].filter(
  (title) => before.has(title) && before.get(title) !== after.get(title),
);

const list = (titles) => {
  const shown = titles.slice(0, 3).join(', ');
  return titles.length > 3 ? `${shown} y ${titles.length - 3} más` : shown;
};
const parts = [];
if (added.length)
  parts.push(`${added.length} ${added.length === 1 ? 'nuevo' : 'nuevos'} (${list(added)})`);
if (changed.length)
  parts.push(
    `${changed.length} ${changed.length === 1 ? 'actualizado' : 'actualizados'} (${list(changed)})`,
  );
if (removed.length)
  parts.push(
    `${removed.length} ${removed.length === 1 ? 'retirado' : 'retirados'} (${list(removed)})`,
  );

console.log(parts.length ? `Wiki: ${parts.join('; ')}` : 'Wiki: imágenes actualizadas');

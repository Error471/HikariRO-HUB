// Pone la versión del instalador (la usa el flujo "Publicar versión" de GitHub Actions).
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Versión no válida: "${version}". Usa el formato 1.2.3.`);
  process.exit(1);
}
const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(path, 'utf8'));
pkg.version = version;
writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Versión ${version}`);

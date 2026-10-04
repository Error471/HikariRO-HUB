// Empaqueta el proceso principal (con la API dentro) en un solo archivo para Electron.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  legalComments: 'none',
  logLevel: 'warning',
});

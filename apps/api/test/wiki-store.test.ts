import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { WikiStore } from '../src/modules/wiki/wiki-store.js';
import { WikiService } from '../src/modules/wiki/wiki.service.js';
import { HIKARI } from './helpers.js';
import { wikiTestData } from './wiki-data.js';

const SOURCE = 'https://wiki.test/wiki';
const fingerprint = (data: Buffer) => ({
  sha256: createHash('sha256').update(data).digest('hex'),
  size: data.length,
});

/** Una "carpeta de GitHub" en memoria: se puede cambiar y estropear entre sincronizaciones. */
function createRemote() {
  const files = new Map<string, Buffer>();
  const requests: string[] = [];
  let offline = false;
  const publish = (version: string, images: Record<string, string>) => {
    files.clear();
    const pagesFile = Buffer.from(JSON.stringify(wikiTestData));
    files.set('pages.json', pagesFile);
    const entries: Record<string, ReturnType<typeof fingerprint>> = {};
    for (const [name, content] of Object.entries(images)) {
      const data = Buffer.from(content);
      files.set(`img/${name}`, data);
      entries[name] = fingerprint(data);
    }
    files.set(
      'manifest.json',
      Buffer.from(JSON.stringify({ version, pages: fingerprint(pagesFile), images: entries })),
    );
  };
  const fetchImpl = (async (input: string | URL | Request) => {
    const path = String(input).replace(`${SOURCE}/`, '');
    requests.push(path);
    if (offline) throw new TypeError('fetch failed');
    const data = files.get(decodeURIComponent(path));
    return data ? new Response(new Uint8Array(data)) : new Response('no', { status: 404 });
  }) as typeof fetch;
  return {
    files,
    requests,
    publish,
    fetchImpl,
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}

describe('WikiStore', () => {
  let dir: string;
  let remote: ReturnType<typeof createRemote>;
  const create = () => {
    const wiki = new WikiService(HIKARI);
    const store = new WikiStore({
      sourceUrl: SOURCE,
      dir,
      wiki,
      fetch: remote.fetchImpl,
      retryDelayMs: 1,
    });
    return { wiki, store };
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'wiki-store-'));
    remote = createRemote();
    remote.publish('v1', { 'pez.png': 'pez', 'mapa.png': 'mapa' });
  });

  it('la primera vez descarga páginas e imágenes y deja la wiki lista', async () => {
    const { wiki, store } = create();
    expect(store.status().state).toBe('downloading');
    await expect(wiki.page('Sistema de pesca')).rejects.toMatchObject({ code: 'WIKI_UNAVAILABLE' });

    await store.sync();

    expect(store.status()).toMatchObject({ state: 'ready', done: 3, total: 3 });
    expect((await wiki.page('Sistema de pesca')).title).toBe('Sistema de pesca');
    expect(readFileSync(join(dir, 'img', 'pez.png'), 'utf8')).toBe('pez');
    expect(store.imagePath('mapa.png')).toBe(join(dir, 'img', 'mapa.png'));
  });

  it('en el siguiente arranque usa lo guardado y no vuelve a descargar nada igual', async () => {
    await create().store.sync();
    remote.requests.length = 0;

    const { wiki, store } = create();
    store.start();
    expect(wiki.ready).toBe(true);
    await store.sync();
    expect(remote.requests).toEqual(['manifest.json']);
  });

  it('solo baja los archivos que han cambiado', async () => {
    await create().store.sync();
    remote.publish('v2', { 'pez.png': 'pez', 'mapa.png': 'mapa nuevo', 'oro.png': 'oro' });
    remote.requests.length = 0;

    const { store } = create();
    store.start();
    await store.sync();

    expect(remote.requests.sort()).toEqual(['img/mapa.png', 'img/oro.png', 'manifest.json']);
    expect(readFileSync(join(dir, 'img', 'mapa.png'), 'utf8')).toBe('mapa nuevo');
  });

  it('elimina las imágenes que ya no se usan', async () => {
    await create().store.sync();
    remote.publish('v2', { 'pez.png': 'pez' });
    await create().store.sync();
    expect(existsSync(join(dir, 'img', 'mapa.png'))).toBe(false);
    expect(existsSync(join(dir, 'img', 'pez.png'))).toBe(true);
  });

  it('sin conexión y sin copia guardada avisa del error y se puede reintentar', async () => {
    remote.setOffline(true);
    const { wiki, store } = create();
    await store.sync();
    expect(store.status().state).toBe('error');
    expect(store.status().message).toMatch(/conexión/);
    expect(wiki.ready).toBe(false);

    remote.setOffline(false);
    await store.sync();
    expect(store.status().state).toBe('ready');
  });

  it('sin conexión pero con copia guardada sigue funcionando', async () => {
    await create().store.sync();
    remote.setOffline(true);
    const { wiki, store } = create();
    store.start();
    await store.sync();
    expect(wiki.ready).toBe(true);
    expect(store.status()).toMatchObject({ state: 'ready', message: null });
  });

  it('rechaza un archivo que no coincide con su huella', async () => {
    remote.files.set('img/pez.png', Buffer.from('manipulado'));
    const { wiki, store } = create();
    await store.sync();
    expect(store.status().state).toBe('error');
    expect(wiki.ready).toBe(false);
    expect(existsSync(join(dir, 'img', 'pez.png'))).toBe(false);
  });

  it('una copia guardada dañada se vuelve a descargar', async () => {
    await create().store.sync();
    writeFileSync(join(dir, 'pages.json'), '{ roto');
    const { wiki, store } = create();
    store.start();
    expect(wiki.ready).toBe(false);
    await store.sync();
    expect(wiki.ready).toBe(true);
  });

  it('no deja salir de la carpeta de imágenes', async () => {
    await create().store.sync();
    const { store } = create();
    for (const name of ['../pages.json', '..\\pages.json', '.env', 'a/b.png', '']) {
      expect(store.imagePath(name), name).toBeNull();
    }
  });

  it('rechaza un manifiesto con nombres de archivo peligrosos', async () => {
    remote.files.set(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          version: 'x',
          pages: fingerprint(remote.files.get('pages.json') ?? Buffer.alloc(0)),
          images: { '../evil.png': fingerprint(Buffer.from('x')) },
        }),
      ),
    );
    const { store } = create();
    await store.sync();
    expect(store.status().state).toBe('error');
    expect(existsSync(join(dir, '..', 'evil.png'))).toBe(false);
  });
});

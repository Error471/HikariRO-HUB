import type { WikiStatus } from '@hikari-hub/shared';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { WikiService } from './wiki.service.js';

const fileEntrySchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().min(0),
});

/** `manifest.json` de la carpeta `wiki/` de GitHub: qué archivos hay y su huella. */
const manifestSchema = z.object({
  version: z.string().min(1),
  pages: fileEntrySchema,
  /** Nombre de archivo → huella. Solo nombres simples (sin carpetas). */
  images: z.record(z.string().regex(/^[\w][\w.-]*$/), fileEntrySchema),
});

type Manifest = z.infer<typeof manifestSchema>;
type FileEntry = z.infer<typeof fileEntrySchema>;

interface Job {
  /** Ruta relativa en el origen y en la carpeta local. */
  path: string;
  entry: FileEntry;
}

interface StoreLogger {
  warn(obj: unknown, message?: string): void;
}

export interface WikiStoreOptions {
  /** Carpeta de GitHub con manifest.json, pages.json e img/ (sin barra final). */
  sourceUrl: string;
  /** Carpeta local donde se guarda la copia. */
  dir: string;
  wiki: WikiService;
  fetch?: typeof fetch;
  logger?: StoreLogger;
  /** Descargas simultáneas. */
  concurrency?: number;
  timeoutMs?: number;
  /** Espera entre reintentos de un archivo (se multiplica por el intento). */
  retryDelayMs?: number;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ATTEMPTS = 3;

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export const wikiImageType = (name: string): string | undefined =>
  IMAGE_TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()];

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

/**
 * Copia local de la wiki. Las páginas y las imágenes viven en GitHub (carpeta `wiki/`): la primera vez
 * que se abre la app se descargan a `dir`; después se usa lo guardado y, en segundo plano, solo se bajan
 * los archivos que hayan cambiado. Sin conexión se sigue usando la copia que ya hay.
 */
export class WikiStore {
  private logger: StoreLogger | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private running: Promise<void> | null = null;
  private failure: string | null = null;
  private done = 0;
  private total = 0;

  constructor(private readonly options: WikiStoreOptions) {
    this.logger = options.logger;
    this.fetchImpl = options.fetch ?? fetch;
    this.concurrency = options.concurrency ?? 6;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  status(): WikiStatus {
    if (this.options.wiki.ready)
      return { state: 'ready', done: this.done, total: this.total, message: null };
    if (this.failure && !this.running) {
      return { state: 'error', done: this.done, total: this.total, message: this.failure };
    }
    return { state: 'downloading', done: this.done, total: this.total, message: null };
  }

  /** Carga lo guardado y comprueba en segundo plano si hay algo nuevo en GitHub. */
  start(logger?: StoreLogger): void {
    if (logger) this.logger = logger;
    this.loadFromDisk();
    void this.sync();
  }

  /** Descarga lo que falte o haya cambiado. Si ya hay una en curso, espera a esa. */
  sync(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Ruta de una imagen descargada, o null si no existe (o el nombre no es válido). */
  imagePath(name: string): string | null {
    if (!/^[\w][\w.-]*$/.test(name)) return null;
    const file = join(this.options.dir, 'img', name);
    return existsSync(file) ? file : null;
  }

  private loadFromDisk(): void {
    const pages = join(this.options.dir, 'pages.json');
    if (!existsSync(pages)) return;
    try {
      this.options.wiki.load(JSON.parse(readFileSync(pages, 'utf8')));
    } catch (error) {
      // Archivo dañado: se vuelve a descargar entero.
      this.logger?.warn({ err: error }, 'La copia local de la wiki está dañada');
      rmSync(this.manifestFile, { force: true });
    }
  }

  private get manifestFile() {
    return join(this.options.dir, 'manifest.json');
  }

  private readLocalManifest(): Manifest | null {
    try {
      return manifestSchema.parse(JSON.parse(readFileSync(this.manifestFile, 'utf8')));
    } catch {
      return null;
    }
  }

  private async run(): Promise<void> {
    this.failure = null;
    this.done = 0;
    this.total = 0;
    try {
      const manifest = manifestSchema.parse(
        JSON.parse(new TextDecoder().decode(await this.download('manifest.json'))),
      );
      const local = this.readLocalManifest();
      if (local?.version === manifest.version && this.options.wiki.ready) return;

      const jobs = this.pending(manifest, local);
      this.total = jobs.length;
      if (jobs.length > 0) await this.downloadAll(jobs);

      // La portada y las páginas van al final: las imágenes que citan ya están en disco.
      const pages = join(this.options.dir, 'pages.json');
      this.options.wiki.load(JSON.parse(readFileSync(pages, 'utf8')));
      writeFileSync(this.manifestFile, JSON.stringify(manifest));
      this.removeStaleImages(manifest);
    } catch (error) {
      this.failure = 'Comprueba tu conexión a internet e inténtalo de nuevo.';
      this.logger?.warn({ err: error }, 'No se ha podido sincronizar la wiki');
    }
  }

  private pending(manifest: Manifest, local: Manifest | null): Job[] {
    const jobs: Job[] = [];
    const consider = (path: string, entry: FileEntry, previous: FileEntry | undefined) => {
      const file = join(this.options.dir, path);
      const unchanged =
        existsSync(file) &&
        statSync(file).size === entry.size &&
        (previous === undefined || previous.sha256 === entry.sha256);
      if (!unchanged) jobs.push({ path, entry });
    };
    for (const [name, entry] of Object.entries(manifest.images)) {
      consider(`img/${name}`, entry, local?.images[name]);
    }
    // pages.json el último: así `jobs` mantiene el orden "imágenes, luego páginas".
    consider('pages.json', manifest.pages, local?.pages);
    return jobs;
  }

  private async downloadAll(jobs: Job[]): Promise<void> {
    mkdirSync(join(this.options.dir, 'img'), { recursive: true });
    const queue = [...jobs];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const data = await this.download(job.path, job.entry);
        const target = join(this.options.dir, job.path);
        const temp = `${target}.part`;
        writeFileSync(temp, data);
        renameSync(temp, target);
        this.done += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, jobs.length) }, worker));
  }

  private async download(path: string, expected?: FileEntry): Promise<Uint8Array> {
    const url = `${this.options.sourceUrl.replace(/\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
    let lastError: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (!response.ok) throw new Error(`${response.status} al pedir ${path}`);
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.length > MAX_FILE_BYTES) throw new Error(`${path} es demasiado grande`);
        if (expected && (data.length !== expected.size || sha256(data) !== expected.sha256)) {
          throw new Error(`${path} no coincide con el manifiesto`);
        }
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < ATTEMPTS)
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
      }
    }
    throw lastError;
  }

  private removeStaleImages(manifest: Manifest): void {
    const folder = join(this.options.dir, 'img');
    if (!existsSync(folder)) return;
    for (const name of readdirSync(folder)) {
      if (!(name in manifest.images)) rmSync(join(folder, name), { force: true });
    }
  }
}

import type { FastifyInstance } from 'fastify';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockHikari, createTestApp } from './helpers.js';

describe('web servida por la API (app de escritorio)', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'hikari-web-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Hikari Hub</title>');
    writeFileSync(join(dir, 'assets', 'app-1234.js'), 'console.log(1)');
    ({ agent } = createMockHikari());
    ({ app } = await createTestApp(agent, { webDir: dir }));
  });

  afterEach(async () => {
    await app.close();
    await agent.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('sirve los recursos con caché larga y CSP de la web', async () => {
    const response = await app.inject({ method: 'GET', url: '/assets/app-1234.js' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('devuelve index.html en las rutas de la SPA', async () => {
    for (const url of ['/', '/mvp?filter=favorites', '/wiki/Reglas']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.body).toContain('<title>Hikari Hub</title>');
    }
  });

  it('las rutas desconocidas de la API siguen devolviendo JSON', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('no sirve archivos fuera de la carpeta de la web', async () => {
    const response = await app.inject({ method: 'GET', url: '/../package.json' });
    expect(response.body).not.toContain('"name"');
  });
});

describe('límite de peticiones con la web servida por la API', () => {
  it('no limita los archivos de la web', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hikari-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    const { agent } = createMockHikari();
    const { app } = await createTestApp(agent, { webDir: dir });
    const statuses = new Set<number>();
    for (let index = 0; index < 320; index += 1) {
      statuses.add((await app.inject({ method: 'GET', url: '/mvp' })).statusCode);
    }
    expect([...statuses]).toEqual([200]);
    await app.close();
    await agent.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

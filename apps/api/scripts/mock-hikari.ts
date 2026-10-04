/**
 * Servidor que imita el login de FluxCP de HikariRO para desarrollar sin conexión.
 * Credenciales de prueba: demo / demo. Uso: pnpm --filter @hikari-hub/api mock:hikari
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const PORT = Number(process.env.MOCK_HIKARI_PORT ?? 4010);
const sessions = new Set<string>();

const loginPage = `<html><body><form action="/?module=account&amp;action=login&amp;return_url=" method="post">
<input type="hidden" name="server" value="MockSrv1"><input name="username"><input type="password" name="password">
<button type="submit" name="submit">Entrar</button></form></body></html>`;
const accountPage = `<html><body><a href="/?module=account&amp;action=logout">Salir</a></body></html>`;

function mvpData() {
  const now = Math.floor(Date.now() / 1000);
  const row = (
    id: number,
    name: string,
    map: string,
    killedAgo: number | null,
    min: number,
    max: number,
  ) => ({
    configured: true,
    id,
    name,
    map,
    killed_at: killedAgo === null ? null : now - killedAgo,
    min_at: killedAgo === null ? null : now - killedAgo + min,
    max_at: killedAgo === null ? null : now - killedAgo + max,
    now,
  });
  return {
    ok: true,
    server_now: now,
    rows: [
      row(1511, 'Amon Ra', 'moc_pryd06', null, 3600, 4200),
      row(1039, 'Baphomet', 'prt_maze03', 1800, 7200, 7800),
      row(30027, 'Arachne', 'cavemine01', 3700, 3600, 4200),
      row(30027, 'Arachne', 'cavemine02', null, 3600, 4200),
      row(1157, 'Pharaoh', 'in_sphinx5', 300, 3600, 4200),
      row(1112, 'Drake', 'treasure02', 6000, 7200, 7800),
    ],
  };
}

const newsFeed = {
  ok: true,
  updated_at: new Date().toISOString(),
  posts: [
    {
      id: '1',
      section: 'noticias',
      author: 'Equipo de prueba',
      content:
        '@everyone\n# 🎃 **Evento de prueba**\n\nEste es un post de ejemplo del mock.\n- Primer punto\n- Segundo punto con **negrita** y `código`\n\nMás info: https://hikariro.com',
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
      image: '',
      url: 'https://discord.com/channels/1/2/1',
    },
    {
      id: '2',
      section: 'changelog',
      author: 'Staff',
      content: '⚔️ Cambios de prueba\nAjustes varios para desarrollo local.',
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      image: '',
      url: 'https://discord.com/channels/1/3/2',
    },
  ],
};

/** Mercados servidos desde las fixtures de los tests. */
function marketPage(module: string, action: string | null, id: string | null): string | null {
  const prefix = module === 'vending' ? 'vending' : 'buying';
  const name = action === 'viewshop' ? `${prefix}-shop-${id}.html` : `${prefix}-list.html`;
  const file = new URL(`../test/fixtures/${name}`, import.meta.url);
  const fallback = new URL('../test/fixtures/shop-not-found.html', import.meta.url);
  return readFileSync(existsSync(file) ? file : fallback, 'utf8');
}

/** Respuestas mínimas de la API de MediaWiki para la Wiki. */
// Títulos reales de la wiki (octubre de 2026) para que el mock tenga el tamaño de la realidad.
const WIKI_CATEGORIES: [string, number][] = [
  ['Contenido de nivel 240', 1],
  ['Enchantment', 1],
  ['Episodios', 1],
  ['Eventos', 5],
  ['Features', 2],
  ['General Information', 1],
  ['Guilds', 1],
  ['Guías', 21],
  ['Halloween', 1],
  ['HikariRO', 1],
  ['Illusion Dungeons', 10],
  ['Instancias', 8],
  ['Mazmorras', 1],
  ['Objetos', 1],
  ['Pesca', 1],
  ['Quests', 3],
  ['Sistemas', 2],
  ['Sistemas de HikariRO', 1],
];
const WIKI_GUIDES = [
  'Achievements',
  'Album de cartas',
  'Clock Tower: Unknown Basement',
  'Episode Clear Ticket',
  'Guia de Oficios',
  'Halloween',
  'HikariRO Enchants',
  'Illusion of Mine Cave',
  'Leveo',
  'Lo que debe saber un Guild Master',
  'Lucky Roulette',
  'Navi System',
  'PVP Battlegrounds (BG)',
  'Pack de bienvenida',
  'Recompensas Eden coin',
  'Safe Certificate',
  'Sistema de Granja',
  'Sistema de Refinamiento',
  'Sistema de mineria',
  'Sistema de pesca',
  'VIP System',
];
const WIKI_PAGES = [
  '4rtas clases',
  'Achievements',
  'Album de cartas',
  'Arena of Heroes',
  'Astral Temple',
  'Channel System',
  'Christmas',
  'Clock Tower: Unknown Basement',
  'Comandos Jugadores',
  'Episode Clear Ticket',
  'Equipo de grupo eden',
  'Equipos Good & evil',
  'Equipos y Encantos Mine Dungeon',
  'Eventos automáticos',
  'FAQs',
  'Fallen Angel Wing Enchants',
  'Fidelity Coins',
  'Guia de Oficios',
  'Guia de Progreso Por Ronova',
  'Guild Succession',
  'Guía para subir de nivel',
  'Halloween',
  'Halloween en Hikari Ro',
  'Hard Mine Dungeon',
  'Hikari AutoAttack Control',
  'Hikari City',
  'HikariRO Enchants',
  'Illusion Dungeons',
  'Illusion Frozen',
  'Illusion Lab',
  'Illusion Labyrint',
  'Illusion Luanda',
  'Illusion Mine',
  'Illusion Mooblight',
  'Illusion Moonlight',
  'Illusion Teddy',
  'Illusion Under Water',
  'Illusion Vampire',
  'Illusion Water',
  'Illusion of Abyss',
  'Illusion of Mine Cave',
  'Illusion of Twins',
  'Instance Cave Mine',
  'Item Reform',
  'Leveo',
  'Lia la aventurera',
  'Lo que debe saber un Guild Master',
  'Lucky Roulette',
  'Marketplace',
  'Masacre - Estados Aleatorios',
  'Mascotas / Pets',
  'Mercenarios',
  'Monthly PvP Ranking',
  'Navi System',
  'Navigation',
  'Obtener Equipo',
  'PVP Battlegrounds (BG)',
  'Pack de bienvenida',
  'Poring Village',
  'Problemas al iniciar',
  'Página principal',
  'Página principal/Equipos evil and Good',
  'Quest Diarias 175+',
  'Quests',
  'Recolorear Headgear',
  'Recompensas Eden coin',
  'Reglas',
  'Safe Certificate',
  'Shadow Gears',
  'Sistema de Cocina',
  'Sistema de Granja',
  'Sistema de Refinamiento',
  'Sistema de clanes',
  'Sistema de mineria',
  'Sistema de pesca',
  'Sky City',
  'Sonic x Ragnarok Online Collaboration (Instancia Custom)',
  'Staff',
  'The Eight Uniques',
  'The Haunted House',
  'Transfer-Pack',
  'VIP System',
  "Varmundt's Biosphere HikariRo",
  'Veil - Ciudad Mercantil',
  'Votar por el servidor',
  'Vídeos YouTube',
  'War of Emperium',
  'War of Emperium Training Edition',
];

function wikiApi(params: URLSearchParams): unknown {
  if (params.get('action') === 'parse') {
    const page = params.get('page') ?? '';
    if (page === 'No existe') return { error: { code: 'missingtitle' } };
    const data = JSON.parse(
      readFileSync(new URL('../test/fixtures/wiki-parse.json', import.meta.url), 'utf8'),
    );
    data.parse.title = page.replace(/_/g, ' ') || data.parse.title;
    delete data.parse.redirects;
    return data;
  }
  const list = params.get('list') ?? '';
  if (list.includes('search')) {
    const q = params.get('srsearch') ?? '';
    return {
      query: {
        searchinfo: { totalhits: 1 },
        search: [
          {
            title: 'Sistema de pesca',
            snippet: `Guía del <span class='searchmatch'>${q}</span> en HikariRO`,
            timestamp: '2026-09-12T13:31:14Z',
            wordcount: 2717,
          },
        ],
        prefixsearch: [{ ns: 0, title: 'Sistema de pesca' }],
      },
    };
  }
  if (list === 'allcategories') {
    return {
      query: {
        allcategories: WIKI_CATEGORIES.map(([category, pages]) => ({ category, pages })),
      },
    };
  }
  if (list === 'categorymembers') {
    return {
      query: {
        categorymembers: WIKI_GUIDES.map((title) => ({ ns: 0, title })),
      },
    };
  }
  return {
    query: {
      allpages: WIKI_PAGES.map((title) => ({ title })),
    },
  };
}

function sessionOf(cookie: string | undefined): string | undefined {
  return cookie?.match(/fluxSessionData=([^;]+)/)?.[1];
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const action = `${url.searchParams.get('module')}/${url.searchParams.get('action')}`;
  const sid = sessionOf(req.headers.cookie) ?? randomUUID();
  res.setHeader('set-cookie', `fluxSessionData=${sid}; path=/; SameSite=Lax`);

  if (action === 'account/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const form = new URLSearchParams(body);
      if (form.get('username') === 'demo' && form.get('password') === 'demo') sessions.add(sid);
      res
        .writeHead(302, {
          location: sessions.has(sid) ? '/?module=main' : '/?module=account&action=login',
        })
        .end();
    });
    return;
  }
  if (action === 'account/login')
    return void res.writeHead(200, { 'content-type': 'text/html' }).end(loginPage);
  if (action === 'account/logout') {
    sessions.delete(sid);
    return void res.writeHead(302, { location: '/?module=main' }).end();
  }
  const module = url.searchParams.get('module');
  if (module === 'cartaslog' || module === 'fishingalbum') {
    if (!sessions.has(sid)) {
      return void res
        .writeHead(302, { location: '/?module=account&action=login&return_url=%2F' })
        .end();
    }
    const name = module === 'cartaslog' ? 'cards-album.html' : 'fishing-album.html';
    const page = readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8');
    return void res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  }
  if (module === 'vending' || module === 'buyingstore') {
    const page = marketPage(module, url.searchParams.get('action'), url.searchParams.get('id'));
    return void res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  }
  if (url.pathname === '/wiki/api.php') {
    return void res
      .writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      .end(JSON.stringify(wikiApi(url.searchParams)));
  }
  if (url.pathname === '/discord/feed.php') {
    return void res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify(newsFeed));
  }
  if (action === 'mvptimer/null' && url.searchParams.get('ajax') === '1') {
    if (!sessions.has(sid)) {
      return void res
        .writeHead(302, {
          location: '/?module=account&action=login&return_url=%2F%3Fmodule%3Dmvptimer',
        })
        .end();
    }
    return void res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify(mvpData()));
  }
  if (action === 'account/view') {
    if (!sessions.has(sid)) {
      return void res
        .writeHead(302, {
          location:
            '/?module=account&action=login&return_url=%2F%3Fmodule%3Daccount%26action%3Dview',
        })
        .end();
    }
    return void res.writeHead(200, { 'content-type': 'text/html' }).end(accountPage);
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`Mock de HikariRO en http://localhost:${PORT} (demo / demo)`));

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import {
  Activity,
  BookOpenText,
  Check,
  CornerDownLeft,
  Hourglass,
  Layers,
  Search,
  ShieldCheck,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { dashboardLink, modules } from '@/app/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { cardAlbumQuery } from '@/features/albums/album-query';
import { marketSearchQuery } from '@/features/markets/market-query';
import { mvpQuery } from '@/features/mvp/mvp-query';
import { wikiIndexQuery } from '@/features/wiki/wiki-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatZeny } from '@/lib/format';
import { matches, searchMvps, searchTitles, summarizeItems } from './search-sources';

// --- Contexto: cualquier botón puede abrir la búsqueda ---
const PaletteContext = createContext<() => void>(() => undefined);

export const useOpenCommandPalette = () => useContext(PaletteContext);

export const isMac = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);

export const shortcutLabel = () => (isMac() ? '⌘K' : 'Ctrl K');

const moduleKeywords: Record<string, string> = {
  mvp: 'respawn jefes temporizador',
  vending: 'tiendas venta mercado',
  'buying-store': 'compra mercado',
  'market-search': 'objeto item mercado precio',
  news: 'eventos changelog',
  wiki: 'guias',
  cards: 'album coleccion',
  fishing: 'album peces',
};

interface PageEntry {
  /** No se lista con la búsqueda vacía. */
  hidden?: boolean;
  label: string;
  path: string;
  icon: LucideIcon;
  keywords: string;
}

const pages: PageEntry[] = [
  { ...dashboardLink, keywords: 'inicio portada resumen' },
  ...Object.values(modules).map((module) => ({
    label: module.label,
    path: module.path,
    icon: module.icon,
    keywords: moduleKeywords[module.id] ?? '',
  })),
  // Solo aparece al buscarlo: no es un módulo más.
  {
    label: 'Diagnóstico',
    path: '/diagnostico',
    icon: Activity,
    keywords: 'errores estado ayuda',
    hidden: true,
  },
  { label: 'Privacidad', path: '/privacidad', icon: ShieldCheck, keywords: 'datos borrar' },
];

const MIN_REMOTE_QUERY = 2;

const itemClass =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted data-[selected=true]:bg-white/7 data-[selected=true]:text-ink';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[0.68rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-faint';

function Thumb({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="size-7 shrink-0 object-contain [image-rendering:pixelated]"
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

function PaletteResults({ query, go }: { query: string; go: (href: string) => void }) {
  const debounced = useDebouncedValue(query.trim(), 250);
  const remote = debounced.length >= MIN_REMOTE_QUERY;

  const mvp = useQuery(mvpQuery);
  const wiki = useQuery(wikiIndexQuery);
  const market = useQuery({ ...marketSearchQuery(debounced), enabled: remote });
  const cards = useQuery({
    ...cardAlbumQuery({ status: 'all', sort: 'id', q: debounced, page: 1 }),
    enabled: remote,
  });

  const trimmed = query.trim();
  const visiblePages = trimmed
    ? pages.filter((page) => matches(`${page.label} ${page.keywords}`, trimmed))
    : pages.filter((page) => !page.hidden);
  const mvps = searchMvps(mvp.data?.mvps ?? [], trimmed);
  const titles = searchTitles(wiki.data?.pages ?? [], trimmed);
  // Los resultados anteriores se mantienen mientras llega la nueva búsqueda: se filtran aquí.
  const items =
    market.data && remote
      ? summarizeItems(market.data, 20)
          .filter((item) => matches(item.name, trimmed))
          .slice(0, 5)
      : [];
  const cardResults = remote
    ? (cards.data?.cards ?? []).filter((card) => matches(card.name, trimmed)).slice(0, 5)
    : [];
  const loading = remote && (market.isFetching || cards.isFetching);
  const encoded = encodeURIComponent(trimmed);

  return (
    <Command.List className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2">
      {loading && (
        <Command.Loading>
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-faint">
            <Spinner /> Buscando en HikariRO…
          </div>
        </Command.Loading>
      )}

      {visiblePages.length > 0 && (
        <Command.Group heading="Secciones" className={groupClass}>
          {visiblePages.map((page) => {
            const Icon = page.icon;
            return (
              <Command.Item
                key={page.path}
                value={`page:${page.path}`}
                onSelect={() => go(page.path)}
                className={itemClass}
              >
                <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                {page.label}
              </Command.Item>
            );
          })}
        </Command.Group>
      )}

      {mvps.length > 0 && (
        <Command.Group heading="MVPs" className={groupClass}>
          {mvps.map((result) => (
            <Command.Item
              key={result.name}
              value={`mvp:${result.name}`}
              onSelect={() => go(`/mvp?q=${encodeURIComponent(result.name)}`)}
              className={itemClass}
            >
              <Thumb src={result.imageUrl} />
              <span className="flex-1 truncate text-ink">{result.name}</span>
              <span className="truncate font-mono text-xs text-ink-faint">
                {[...new Set(result.maps)].slice(0, 2).join(', ')}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {items.length > 0 && (
        <Command.Group heading="Mercado" className={groupClass}>
          {items.map((item) => (
            <Command.Item
              key={item.itemId}
              value={`item:${item.itemId}`}
              onSelect={() => go(`/mercados/buscar?q=${encodeURIComponent(item.name)}`)}
              className={itemClass}
            >
              <Thumb src={item.iconUrl} />
              <span className="flex-1 truncate text-ink">{item.name}</span>
              <span className="shrink-0 text-right text-xs tabular-nums text-ink-faint">
                {item.lowestSell !== null && <>Venden desde {formatZeny(item.lowestSell)}</>}
                {item.lowestSell !== null && item.highestBuy !== null && ' · '}
                {item.highestBuy !== null && <>Compran a {formatZeny(item.highestBuy)}</>}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {titles.length > 0 && (
        <Command.Group heading="Wiki" className={groupClass}>
          {titles.map((title) => (
            <Command.Item
              key={title}
              value={`wiki:${title}`}
              onSelect={() => go(`/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`)}
              className={itemClass}
            >
              <BookOpenText aria-hidden="true" className="size-4.5 shrink-0" />
              <span className="truncate text-ink">{title}</span>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {cardResults.length > 0 && (
        <Command.Group heading="Tus cartas" className={groupClass}>
          {cardResults.map((card) => (
            <Command.Item
              key={card.id}
              value={`card:${card.id}`}
              onSelect={() => go(`/albumes/cartas?q=${encodeURIComponent(card.name)}`)}
              className={itemClass}
            >
              <Thumb src={card.iconUrl} />
              <span className="flex-1 truncate text-ink">{card.name}</span>
              {card.obtained ? (
                <span className="flex items-center gap-1 text-xs text-leaf-400">
                  <Check aria-hidden="true" className="size-3.5" /> Obtenida
                </span>
              ) : (
                <span className="text-xs text-ink-faint">Pendiente</span>
              )}
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {trimmed && (
        <Command.Group heading="Buscar en" className={groupClass}>
          <Command.Item
            value="action:market"
            onSelect={() => go(`/mercados/buscar?q=${encoded}`)}
            className={itemClass}
          >
            <Store aria-hidden="true" className="size-4.5 shrink-0" />
            <span className="truncate">«{trimmed}» en todos los mercados</span>
          </Command.Item>
          <Command.Item
            value="action:wiki"
            onSelect={() => go(`/wiki/buscar?q=${encoded}`)}
            className={itemClass}
          >
            <BookOpenText aria-hidden="true" className="size-4.5 shrink-0" />
            <span className="truncate">«{trimmed}» en la wiki</span>
          </Command.Item>
          <Command.Item
            value="action:mvp"
            onSelect={() => go(`/mvp?q=${encoded}`)}
            className={itemClass}
          >
            <Hourglass aria-hidden="true" className="size-4.5 shrink-0" />
            <span className="truncate">«{trimmed}» en el MVP Timer</span>
          </Command.Item>
          <Command.Item
            value="action:cards"
            onSelect={() => go(`/albumes/cartas?q=${encoded}`)}
            className={itemClass}
          >
            <Layers aria-hidden="true" className="size-4.5 shrink-0" />
            <span className="truncate">«{trimmed}» en tus cartas</span>
          </Command.Item>
        </Command.Group>
      )}
    </Command.List>
  );
}

/** Búsqueda global (Ctrl+K / ⌘K): secciones, MVPs, mercado, wiki y cartas. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  }, []);

  const go = useCallback(
    (href: string) => {
      changeOpen(false);
      void navigate({ href });
    },
    [changeOpen, navigate],
  );

  const openPalette = useCallback(() => setOpen(true), []);

  return (
    <PaletteContext.Provider value={openPalette}>
      {children}
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/75 backdrop-blur-sm data-[state=open]:animate-fade" />
          <Dialog.Content
            aria-describedby={undefined}
            className="panel fixed top-[12dvh] left-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-card shadow-2xl data-[state=open]:animate-fade"
          >
            <Dialog.Title className="sr-only">Búsqueda global</Dialog.Title>
            <Command shouldFilter={false} loop label="Búsqueda global">
              <div className="flex items-center gap-3 border-b border-white/8 px-4">
                <Search aria-hidden="true" className="size-4.5 shrink-0 text-ink-faint" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Busca un MVP, un objeto, una página de la wiki o una carta…"
                  className="h-14 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
                />
                <kbd className="hidden shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-faint sm:block">
                  Esc
                </kbd>
              </div>
              {open && <PaletteResults query={query} go={go} />}
              <div className="hidden items-center gap-4 border-t border-white/8 px-4 py-2 text-[0.7rem] text-ink-faint sm:flex">
                <span className="flex items-center gap-1">
                  <CornerDownLeft aria-hidden="true" className="size-3.5" /> abrir
                </span>
                <span>↑↓ moverse</span>
                <span className="ml-auto">{shortcutLabel()} para abrir desde cualquier sitio</span>
              </div>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PaletteContext.Provider>
  );
}

/** Botón de búsqueda con el atajo de teclado visible. */
export function SearchButton({ className }: { className?: string }) {
  const openPalette = useOpenCommandPalette();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-keyshortcuts="Control+K Meta+K"
      className={
        className ??
        'flex min-h-10 w-full items-center gap-2 rounded-lg border border-white/8 bg-night-800/60 px-3 text-sm text-ink-faint transition hover:border-white/15 hover:text-ink-muted'
      }
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border border-white/10 px-1.5 font-mono text-[0.68rem]">
        {shortcutLabel()}
      </kbd>
    </button>
  );
}

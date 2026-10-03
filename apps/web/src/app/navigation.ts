import {
  BookOpenText,
  Fish,
  Hourglass,
  LayoutDashboard,
  Layers,
  Megaphone,
  Search,
  ShoppingBag,
  Store,
  type LucideIcon,
} from 'lucide-react';

export type ModulePath =
  | '/mvp'
  | '/mercados/vending'
  | '/mercados/buying-store'
  | '/mercados/buscar'
  | '/noticias'
  | '/wiki'
  | '/albumes/cartas'
  | '/albumes/pesca';

export interface ModuleDefinition {
  id: string;
  label: string;
  path: ModulePath;
  icon: LucideIcon;
  description: string;
  /** Página original de HikariRO, para el enlace de respaldo. */
  sourceUrl: string;
  /** Fase del roadmap en la que se integra el módulo. */
  phase: number;
  available: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: ModuleDefinition[];
}

const HIKARI = 'https://hikariro.com';

export const modules = {
  mvp: {
    id: 'mvp',
    label: 'MVP Timer',
    path: '/mvp',
    icon: Hourglass,
    description: 'Respawns en tiempo real, ventanas de aparición y estado de cada MVP.',
    sourceUrl: `${HIKARI}/?module=mvptimer`,
    phase: 2,
    available: true,
  },
  vending: {
    id: 'vending',
    label: 'Vending',
    path: '/mercados/vending',
    icon: Store,
    description: 'Tiendas de venta abiertas: vendedores, ubicación, objetos y precios.',
    sourceUrl: `${HIKARI}/?module=vending`,
    phase: 3,
    available: true,
  },
  buyingStore: {
    id: 'buying-store',
    label: 'Buying Store',
    path: '/mercados/buying-store',
    icon: ShoppingBag,
    description: 'Ofertas de compra activas: qué se busca, cuánto y a qué precio.',
    sourceUrl: `${HIKARI}/?module=buyingstore`,
    phase: 3,
    available: true,
  },
  marketSearch: {
    id: 'market-search',
    label: 'Buscar item',
    path: '/mercados/buscar',
    icon: Search,
    description: 'Busca un objeto en todas las tiendas de venta y de compra a la vez.',
    sourceUrl: `${HIKARI}/?module=vending`,
    phase: 3,
    available: true,
  },
  news: {
    id: 'news',
    label: 'Noticias',
    path: '/noticias',
    icon: Megaphone,
    description: 'Noticias, eventos y changelog publicados por el equipo de HikariRO.',
    sourceUrl: `${HIKARI}/?module=main#news`,
    phase: 2,
    available: true,
  },
  wiki: {
    id: 'wiki',
    label: 'Wiki',
    path: '/wiki',
    icon: BookOpenText,
    description: 'Guías, instancias y sistemas del servidor con búsqueda y categorías.',
    sourceUrl: `${HIKARI}/wiki/index.php?title=P%C3%A1gina_principal`,
    phase: 4,
    available: true,
  },
  cards: {
    id: 'cards',
    label: 'Cartas',
    path: '/albumes/cartas',
    icon: Layers,
    description: 'Tu álbum de cartas: obtenidas, pendientes y progreso de la colección.',
    sourceUrl: `${HIKARI}/?module=cartaslog`,
    phase: 5,
    available: true,
  },
  fishing: {
    id: 'fishing',
    label: 'Pesca',
    path: '/albumes/pesca',
    icon: Fish,
    description: 'Tu álbum de pesca: especies descubiertas, récords y capturas.',
    sourceUrl: `${HIKARI}/?module=fishingalbum`,
    phase: 5,
    available: true,
  },
} satisfies Record<string, ModuleDefinition>;

export const dashboardLink = { label: 'Dashboard', path: '/', icon: LayoutDashboard } as const;

export const navigation: NavGroup[] = [
  { id: 'mvp', label: 'MVP Timer', items: [modules.mvp] },
  {
    id: 'markets',
    label: 'Mercados',
    items: [modules.vending, modules.buyingStore, modules.marketSearch],
  },
  { id: 'news', label: 'Noticias', items: [modules.news] },
  { id: 'wiki', label: 'Wiki', items: [modules.wiki] },
  { id: 'albums', label: 'Álbumes', items: [modules.cards, modules.fishing] },
];

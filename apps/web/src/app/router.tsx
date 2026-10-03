import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusScreen } from '@/components/ui/StatusScreen';
import { LoginPage, safeRedirect } from '@/features/auth/LoginPage';
import { sessionQuery } from '@/features/auth/session';
import { PwaUpdater } from '@/features/pwa/PwaUpdater';
import { errorMessage } from '@/lib/api-client';
import { AppShell } from './layout/AppShell';
import { modules } from './navigation';

export interface RouterContext {
  queryClient: QueryClient;
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors closeButton />
      <PwaUpdater />
    </>
  ),
  pendingComponent: () => <StatusScreen title="Conectando…" busy />,
  errorComponent: ({ error, reset }) => (
    <StatusScreen
      title="Algo ha fallado"
      description={errorMessage(error)}
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  ),
  notFoundComponent: () => (
    <StatusScreen
      title="Esta zona no aparece en el mapa"
      description="La página que buscas no existe."
      action={
        <Link to="/" className="text-gold-300 underline-offset-4 hover:underline">
          Volver al dashboard
        </Link>
      }
    />
  ),
});

const loginSearchSchema = z.object({
  redirect: z.string().max(512).optional().catch(undefined),
  reason: z.literal('expired').optional().catch(undefined),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const state = await context.queryClient.ensureQueryData(sessionQuery);
    if (state.status === 'authenticated') throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: function LoginRoute() {
    const search = loginRoute.useSearch();
    return <LoginPage redirectTo={search.redirect} reason={search.reason} />;
  },
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacidad',
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(sessionQuery);
    return { authenticated: state.status === 'authenticated' };
  },
  component: lazyRouteComponent(() => import('./routes/PrivacyRoute'), 'PrivacyRoute'),
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    const state = await context.queryClient.ensureQueryData(sessionQuery);
    if (state.status !== 'authenticated') {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
          reason: state.reason === 'expired' ? 'expired' : undefined,
        },
      });
    }
    return { user: state.session.user };
  },
  component: function AppLayout() {
    const { user } = appRoute.useRouteContext();
    return <AppShell username={user.username} />;
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./routes/DashboardRoute'), 'DashboardRoute'),
  pendingComponent: PageSkeleton,
});

const mvpRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.mvp.path,
  validateSearch: z.object({
    filter: z.enum(['all', 'window', 'cooldown', 'ready', 'favorites']).default('all').catch('all'),
  }),
  component: lazyRouteComponent(() => import('./routes/MvpRoute'), 'MvpRoute'),
  pendingComponent: PageSkeleton,
});

const newsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.news.path,
  validateSearch: z.object({
    section: z.enum(['all', 'noticias', 'eventos', 'changelog']).default('all').catch('all'),
  }),
  component: lazyRouteComponent(() => import('./routes/NewsRoute'), 'NewsRoute'),
  pendingComponent: PageSkeleton,
});

const newsDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/noticias/$postId',
  component: lazyRouteComponent(() => import('./routes/NewsDetailRoute'), 'NewsDetailRoute'),
  pendingComponent: PageSkeleton,
});

const shopSortSchema = z.object({
  sort: z.enum(['id', 'owner', 'map', 'value']).default('id').catch('id'),
});

const vendingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.vending.path,
  validateSearch: shopSortSchema,
  component: lazyRouteComponent(() => import('./routes/MarketRoutes'), 'VendingRoute'),
  pendingComponent: PageSkeleton,
});

const buyingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.buyingStore.path,
  validateSearch: shopSortSchema,
  component: lazyRouteComponent(() => import('./routes/MarketRoutes'), 'BuyingRoute'),
  pendingComponent: PageSkeleton,
});

const vendingShopRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/mercados/vending/$shopId',
  component: lazyRouteComponent(() => import('./routes/MarketRoutes'), 'VendingShopRoute'),
  pendingComponent: PageSkeleton,
});

const buyingShopRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/mercados/buying-store/$shopId',
  component: lazyRouteComponent(() => import('./routes/MarketRoutes'), 'BuyingShopRoute'),
  pendingComponent: PageSkeleton,
});

const marketSearchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.marketSearch.path,
  validateSearch: z.object({ q: z.string().max(64).default('').catch('') }),
  component: lazyRouteComponent(() => import('./routes/MarketRoutes'), 'MarketSearchRoute'),
  pendingComponent: PageSkeleton,
});

const wikiHomeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.wiki.path,
  component: lazyRouteComponent(() => import('./routes/WikiRoutes'), 'WikiHomeRoute'),
  pendingComponent: PageSkeleton,
});

const wikiSearchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/wiki/buscar',
  validateSearch: z.object({ q: z.string().max(100).default('').catch('') }),
  component: lazyRouteComponent(() => import('./routes/WikiRoutes'), 'WikiSearchRoute'),
  pendingComponent: PageSkeleton,
});

const wikiCategoryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/wiki/categoria/$name',
  component: lazyRouteComponent(() => import('./routes/WikiRoutes'), 'WikiCategoryRoute'),
  pendingComponent: PageSkeleton,
});

const wikiArticleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/wiki/$',
  component: lazyRouteComponent(() => import('./routes/WikiRoutes'), 'WikiArticleRoute'),
  pendingComponent: PageSkeleton,
});

const cardAlbumDefaults = { status: 'all', sort: 'id', q: '', page: 1 } as const;

const cardAlbumRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.cards.path,
  validateSearch: z.object({
    status: z.enum(['all', 'found', 'missing']).default('all').catch('all'),
    sort: z.enum(['id', 'name']).default('id').catch('id'),
    q: z.string().max(50).default('').catch(''),
    page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  }),
  search: { middlewares: [stripSearchParams(cardAlbumDefaults)] },
  component: lazyRouteComponent(() => import('./routes/AlbumRoutes'), 'CardAlbumRoute'),
  pendingComponent: PageSkeleton,
});

const fishingAlbumRoute = createRoute({
  getParentRoute: () => appRoute,
  path: modules.fishing.path,
  validateSearch: z.object({
    filter: z.enum(['all', 'caught', 'pending']).default('all').catch('all'),
  }),
  component: lazyRouteComponent(() => import('./routes/AlbumRoutes'), 'FishingAlbumRoute'),
  pendingComponent: PageSkeleton,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  privacyRoute,
  appRoute.addChildren([
    dashboardRoute,
    mvpRoute,
    vendingRoute,
    buyingRoute,
    vendingShopRoute,
    buyingShopRoute,
    marketSearchRoute,
    newsRoute,
    newsDetailRoute,
    wikiHomeRoute,
    wikiSearchRoute,
    wikiCategoryRoute,
    wikiArticleRoute,
    cardAlbumRoute,
    fishingAlbumRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPendingMs: 250,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

export { appRoute };

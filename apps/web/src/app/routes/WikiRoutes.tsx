import { getRouteApi } from '@tanstack/react-router';
import { WikiArticlePage } from '@/features/wiki/WikiArticlePage';
import { WikiCategoryPage } from '@/features/wiki/WikiCategoryPage';
import { WikiHomePage } from '@/features/wiki/WikiHomePage';
import { WikiSearchPage } from '@/features/wiki/WikiSearchPage';
import { titleFromPath } from '@/features/wiki/wiki-query';

const searchApi = getRouteApi('/app/wiki/buscar');
const categoryApi = getRouteApi('/app/wiki/categoria/$name');
const articleApi = getRouteApi('/app/wiki/$');

export function WikiHomeRoute() {
  return <WikiHomePage />;
}

export function WikiSearchRoute() {
  return <WikiSearchPage query={searchApi.useSearch().q} />;
}

export function WikiCategoryRoute() {
  const name = titleFromPath(categoryApi.useParams().name);
  return <WikiCategoryPage key={name} name={name} />;
}

export function WikiArticleRoute() {
  const title = titleFromPath(articleApi.useParams()._splat ?? '');
  // "/wiki/" (con barra final) también encaja en la ruta comodín: se muestra la portada.
  if (!title) return <WikiHomePage />;
  return <WikiArticlePage key={title} title={title} />;
}

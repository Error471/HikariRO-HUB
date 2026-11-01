import { getRouteApi } from '@tanstack/react-router';
import { WikiArticlePage } from '@/features/wiki/WikiArticlePage';
import { WikiCategoryPage } from '@/features/wiki/WikiCategoryPage';
import { WikiGate } from '@/features/wiki/WikiGate';
import { WikiHomePage } from '@/features/wiki/WikiHomePage';
import { WikiSearchPage } from '@/features/wiki/WikiSearchPage';
import { titleFromPath } from '@/features/wiki/wiki-query';

const searchApi = getRouteApi('/wiki-layout/wiki/buscar');
const categoryApi = getRouteApi('/wiki-layout/wiki/categoria/$name');
const articleApi = getRouteApi('/wiki-layout/wiki/$');

export function WikiHomeRoute() {
  return (
    <WikiGate>
      <WikiHomePage />
    </WikiGate>
  );
}

export function WikiSearchRoute() {
  return (
    <WikiGate>
      <WikiSearchPage query={searchApi.useSearch().q} />
    </WikiGate>
  );
}

export function WikiCategoryRoute() {
  const name = titleFromPath(categoryApi.useParams().name);
  return (
    <WikiGate>
      <WikiCategoryPage key={name} name={name} />
    </WikiGate>
  );
}

export function WikiArticleRoute() {
  const title = titleFromPath(articleApi.useParams()._splat ?? '');
  // "/wiki/" (con barra final) también encaja en la ruta comodín: se muestra la portada.
  return (
    <WikiGate>{title ? <WikiArticlePage key={title} title={title} /> : <WikiHomePage />}</WikiGate>
  );
}

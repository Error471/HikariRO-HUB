import { getRouteApi } from '@tanstack/react-router';
import { NewsPage } from '@/features/news/NewsPage';

const route = getRouteApi('/app/noticias');

export function NewsRoute() {
  const { section } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <NewsPage
      section={section}
      onSectionChange={(next) => void navigate({ search: { section: next }, replace: true })}
    />
  );
}

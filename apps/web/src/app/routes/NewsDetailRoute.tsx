import { getRouteApi } from '@tanstack/react-router';
import { NewsDetailPage } from '@/features/news/NewsDetailPage';

const route = getRouteApi('/app/noticias/$postId');

export function NewsDetailRoute() {
  const { postId } = route.useParams();
  return <NewsDetailPage postId={postId} />;
}

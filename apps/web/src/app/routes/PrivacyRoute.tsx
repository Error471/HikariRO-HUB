import { getRouteApi } from '@tanstack/react-router';
import { PrivacyPage } from '@/features/privacy/PrivacyPage';

const route = getRouteApi('/privacidad');

export function PrivacyRoute() {
  const { authenticated } = route.useRouteContext();
  return <PrivacyPage authenticated={authenticated} />;
}

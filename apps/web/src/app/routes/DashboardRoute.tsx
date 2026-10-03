import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { appRoute } from '../router';

export function DashboardRoute() {
  const { user } = appRoute.useRouteContext();
  return <DashboardPage username={user.username} />;
}

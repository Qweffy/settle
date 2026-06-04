import { AppShell } from '@/components/app-shell';
import { getCurrentUserId } from '@/lib/actions/session';
import { ROLES } from '@/lib/data/shell';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve the current "viewing as" actor from the cookie so the topbar shows
  // the real role even after a hard reload (the role gate depends on it).
  const actorId = await getCurrentUserId();
  const roleIdx = Math.max(0, ROLES.findIndex((r) => r.userId === actorId));
  return <AppShell initialRoleIdx={roleIdx}>{children}</AppShell>;
}

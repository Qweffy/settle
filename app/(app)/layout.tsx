import { AppShell } from '@/components/app-shell';
import { getCurrentUserId, getActiveOrg } from '@/lib/actions/session';
import { ROLES, ENTITIES } from '@/lib/data/shell';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve the current "viewing as" actor + active entity from cookies so the
  // topbar shows the real role/org even after a hard reload (the gate + the
  // org-scoped queries depend on them).
  const actorId = await getCurrentUserId();
  const roleIdx = Math.max(0, ROLES.findIndex((r) => r.userId === actorId));
  const activeOrg = await getActiveOrg();
  const entityIdx = Math.max(0, ENTITIES.findIndex((e) => e.id === activeOrg));
  return <AppShell initialRoleIdx={roleIdx} initialEntityIdx={entityIdx}>{children}</AppShell>;
}

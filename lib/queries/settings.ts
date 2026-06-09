import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations, glAccounts } from '@/db/schema';
import { getActiveOrg } from '@/lib/actions/session';
import { getRecurringTemplates, type RecurringRow } from '@/lib/queries/recurring';

export type SettingsGlAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type SettingsData = {
  org: { name: string; sub: string | null; mono: string | null };
  glAccounts: SettingsGlAccount[];
  recurring: RecurringRow[];
};

// Org profile + chart of accounts for the /settings screen, scoped to the demo org.
export async function getSettingsData(): Promise<SettingsData> {
  const activeOrg = await getActiveOrg();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, activeOrg),
  });

  const glRows = await db
    .select({ id: glAccounts.id, code: glAccounts.code, name: glAccounts.name, type: glAccounts.type })
    .from(glAccounts)
    .where(eq(glAccounts.orgId, activeOrg))
    .orderBy(asc(glAccounts.code));

  const recurring = await getRecurringTemplates();

  return {
    org: {
      name: org?.name ?? 'Organization',
      sub: org?.sub ?? null,
      mono: org?.mono ?? null,
    },
    glAccounts: glRows,
    recurring,
  };
}

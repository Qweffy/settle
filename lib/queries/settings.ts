import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations, glAccounts } from '@/db/schema';
import { DEMO_ORG } from '@/lib/demo';

export type SettingsGlAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type SettingsData = {
  org: { name: string; sub: string | null; mono: string | null };
  glAccounts: SettingsGlAccount[];
};

// Org profile + chart of accounts for the /settings screen, scoped to the demo org.
export async function getSettingsData(): Promise<SettingsData> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, DEMO_ORG),
  });

  const glRows = await db
    .select({ id: glAccounts.id, code: glAccounts.code, name: glAccounts.name, type: glAccounts.type })
    .from(glAccounts)
    .where(eq(glAccounts.orgId, DEMO_ORG))
    .orderBy(asc(glAccounts.code));

  return {
    org: {
      name: org?.name ?? 'Organization',
      sub: org?.sub ?? null,
      mono: org?.mono ?? null,
    },
    glAccounts: glRows,
  };
}

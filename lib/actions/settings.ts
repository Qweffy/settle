'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { glAccounts, glType } from '@/db/schema';
import { DEMO_ORG } from '@/lib/demo';
import { parseOrThrow, glAccountInputSchema, idSchema } from '@/lib/validation';

type GlTypeValue = (typeof glType.enumValues)[number];

const rid = (p: string) => `${p}-${randomUUID()}`;

function revalidateSettings() {
  revalidatePath('/settings');
  revalidatePath('/bills/new');
  revalidatePath('/bills/[id]/edit', 'page');
}

export type GlAccountInput = {
  code: string;
  name: string;
  type: string;
};

export async function createGlAccount(input: GlAccountInput): Promise<string> {
  parseOrThrow(glAccountInputSchema, input);
  const id = rid('gl');
  await db.insert(glAccounts).values({
    id,
    orgId: DEMO_ORG,
    code: input.code.trim(),
    name: input.name.trim(),
    type: input.type as GlTypeValue,
  });
  revalidateSettings();
  return id;
}

export async function updateGlAccount(id: string, input: GlAccountInput): Promise<string> {
  parseOrThrow(idSchema, id);
  parseOrThrow(glAccountInputSchema, input);
  await db
    .update(glAccounts)
    .set({
      code: input.code.trim(),
      name: input.name.trim(),
      type: input.type as GlTypeValue,
    })
    .where(eq(glAccounts.id, id));
  revalidateSettings();
  return id;
}

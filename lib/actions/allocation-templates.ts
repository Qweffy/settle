'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { allocationTemplates, type AllocationTemplateLine } from '@/db/schema';
import { getCurrentUserId, getActiveOrg } from './session';
import { parseOrThrow, parseOrResult, idSchema, allocationTemplateSchema } from '@/lib/validation';
import { runAction, type ActionResult } from '@/lib/result';

// Save a line's GL split as a reusable template, org-wide or scoped to a vendor.
export async function createAllocationTemplate(
  name: string,
  lines: AllocationTemplateLine[],
  vendorId?: string,
): Promise<ActionResult<string>> {
  const parsed = parseOrResult(allocationTemplateSchema, { name, lines, vendorId: vendorId ?? null });
  if (!parsed.ok) return parsed;
  return runAction("Couldn't save this allocation template.", async () => {
    const actor = await getCurrentUserId();
    const org = await getActiveOrg();
    const id = `alloc-${randomUUID()}`;
    await db.insert(allocationTemplates).values({
      id,
      orgId: org,
      vendorId: vendorId ?? null,
      name: name.trim(),
      lines,
      createdBy: actor,
    });
    revalidatePath('/bills/new');
    revalidatePath('/bills/[id]/edit', 'page');
    return id;
  });
}

export async function deleteAllocationTemplate(id: string): Promise<void> {
  parseOrThrow(idSchema, id);
  await db.delete(allocationTemplates).where(eq(allocationTemplates.id, id));
  revalidatePath('/bills/new');
  revalidatePath('/bills/[id]/edit', 'page');
}

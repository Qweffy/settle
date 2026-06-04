'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { allocationTemplates, type AllocationTemplateLine } from '@/db/schema';
import { DEMO_ORG } from '@/lib/demo';
import { getCurrentUserId } from './session';
import { parseOrThrow, idSchema, allocationTemplateSchema } from '@/lib/validation';

// Save a line's GL split as a reusable template, org-wide or scoped to a vendor.
export async function createAllocationTemplate(
  name: string,
  lines: AllocationTemplateLine[],
  vendorId?: string,
): Promise<string> {
  parseOrThrow(allocationTemplateSchema, { name, lines, vendorId: vendorId ?? null });
  const actor = await getCurrentUserId();
  const id = `alloc-${randomUUID()}`;
  await db.insert(allocationTemplates).values({
    id,
    orgId: DEMO_ORG,
    vendorId: vendorId ?? null,
    name: name.trim(),
    lines,
    createdBy: actor,
  });
  revalidatePath('/bills/new');
  revalidatePath('/bills/[id]/edit', 'page');
  return id;
}

export async function deleteAllocationTemplate(id: string): Promise<void> {
  parseOrThrow(idSchema, id);
  await db.delete(allocationTemplates).where(eq(allocationTemplates.id, id));
  revalidatePath('/bills/new');
  revalidatePath('/bills/[id]/edit', 'page');
}

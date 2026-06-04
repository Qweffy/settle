'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { savedViews } from '@/db/schema';
import { DEMO_ORG } from '@/lib/demo';
import { getCurrentUserId } from './session';
import { parseOrThrow, parseOrResult, savedViewSchema, idSchema } from '@/lib/validation';
import { runAction, type ActionResult } from '@/lib/result';
import type { SavedViewConfig } from '@/lib/data/bills';

// Save the current bills-list filter state as a named view, shared across the
// org's AP team. Returns the new view's id.
export async function createSavedView(name: string, config: SavedViewConfig): Promise<ActionResult<string>> {
  const parsed = parseOrResult(savedViewSchema, { name, config });
  if (!parsed.ok) return parsed;
  return runAction("Couldn't save this view.", async () => {
    const actor = await getCurrentUserId();
    const id = `view-${randomUUID()}`;
    await db.insert(savedViews).values({
      id,
      orgId: DEMO_ORG,
      name: name.trim() || 'Untitled view',
      config,
      createdBy: actor,
    });
    revalidatePath('/bills');
    return id;
  });
}

export async function deleteSavedView(id: string): Promise<void> {
  parseOrThrow(idSchema, id);
  await db.delete(savedViews).where(eq(savedViews.id, id));
  revalidatePath('/bills');
}

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const ROLE_COOKIE = 'settle-actor';
// Default actor = the approver (Marcus). The demo's "viewing as" switcher overrides it.
const DEFAULT_ACTOR = 'user-marcus';

export async function getCurrentUserId(): Promise<string> {
  const store = await cookies();
  return store.get(ROLE_COOKIE)?.value ?? DEFAULT_ACTOR;
}

export async function setViewingActor(userId: string): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE, userId, { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

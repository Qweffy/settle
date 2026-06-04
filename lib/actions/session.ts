'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const ROLE_COOKIE = 'settle-actor';
// Default actor = the AP clerk (Dana), matching the default "viewing as" shown in
// the topbar — she's who does intake/capture. The role switcher overrides it via cookie.
const DEFAULT_ACTOR = 'user-dana';

export async function getCurrentUserId(): Promise<string> {
  const store = await cookies();
  return store.get(ROLE_COOKIE)?.value ?? DEFAULT_ACTOR;
}

export async function setViewingActor(userId: string): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE, userId, { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

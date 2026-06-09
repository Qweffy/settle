'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEMO_ORG } from '@/lib/demo';

const ROLE_COOKIE = 'settle-actor';
const ORG_COOKIE = 'settle-org';
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

// The active organization (entity switcher). Defaults to Summit Waste Services
// so the app — and the e2e suite — behave identically until you switch entity.
export async function getActiveOrg(): Promise<string> {
  const store = await cookies();
  return store.get(ORG_COOKIE)?.value ?? DEMO_ORG;
}

export async function setActiveEntity(orgId: string): Promise<void> {
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

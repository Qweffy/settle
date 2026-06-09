'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { vendors, paymentTerms, paymentMethod } from '@/db/schema';
import { getActiveOrg } from '@/lib/actions/session';
import { parseOrThrow, vendorInputSchema, idSchema } from '@/lib/validation';

type PaymentTermsValue = (typeof paymentTerms.enumValues)[number];
type PaymentMethodValue = (typeof paymentMethod.enumValues)[number];

const rid = (p: string) => `${p}-${randomUUID()}`;

function revalidateVendors() {
  for (const p of ['/vendors', '/dashboard', '/bills']) {
    revalidatePath(p);
  }
  revalidatePath('/vendors/[id]', 'page');
}

// Two uppercase initials derived from the vendor name (e.g. "Summit Waste" → "SW").
function deriveMono(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const orNull = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

type VendorInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  terms: string;
  defaultMethod: string;
  bankLast4: string;
  defaultGl: string;
};

export async function createVendor(input: VendorInput): Promise<string> {
  parseOrThrow(vendorInputSchema, input);
  const org = await getActiveOrg();
  const vendorId = rid('v');
  await db.insert(vendors).values({
    id: vendorId,
    orgId: org,
    name: input.name.trim(),
    mono: deriveMono(input.name),
    email: orNull(input.email),
    phone: orNull(input.phone),
    address: orNull(input.address),
    taxId: orNull(input.taxId),
    terms: input.terms as PaymentTermsValue,
    defaultMethod: input.defaultMethod as PaymentMethodValue,
    bankLast4: orNull(input.bankLast4),
    status: 'active',
    defaultGl: orNull(input.defaultGl),
  });
  revalidateVendors();
  return vendorId;
}

export async function updateVendor(vendorId: string, input: VendorInput): Promise<string> {
  parseOrThrow(idSchema, vendorId);
  parseOrThrow(vendorInputSchema, input);
  await db
    .update(vendors)
    .set({
      name: input.name.trim(),
      mono: deriveMono(input.name),
      email: orNull(input.email),
      phone: orNull(input.phone),
      address: orNull(input.address),
      taxId: orNull(input.taxId),
      terms: input.terms as PaymentTermsValue,
      defaultMethod: input.defaultMethod as PaymentMethodValue,
      bankLast4: orNull(input.bankLast4),
      defaultGl: orNull(input.defaultGl),
    })
    .where(eq(vendors.id, vendorId));
  revalidateVendors();
  return vendorId;
}

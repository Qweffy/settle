import { notFound } from 'next/navigation';
import { getVendorForEdit } from '@/lib/queries/vendors-list';
import { VendorForm } from '../../vendor-form';

export const dynamic = 'force-dynamic';

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getVendorForEdit(id);
  if (!initial) notFound();
  return <VendorForm initial={initial} editId={id} />;
}

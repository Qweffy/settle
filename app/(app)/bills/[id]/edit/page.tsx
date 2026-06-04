import { notFound } from 'next/navigation';
import { getNewBillFormData, getBillForEdit } from '@/lib/queries/new-bill';
import { BillForm } from '../../bill-form';

export const dynamic = 'force-dynamic';

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, initial] = await Promise.all([getNewBillFormData(), getBillForEdit(id)]);
  if (!initial) notFound();
  return <BillForm data={data} initial={initial} editId={id} />;
}

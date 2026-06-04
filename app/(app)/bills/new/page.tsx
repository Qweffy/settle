import { getNewBillFormData } from '@/lib/queries/new-bill';
import { BillForm } from '../bill-form';

export const dynamic = 'force-dynamic';

export default async function NewBillPage() {
  const data = await getNewBillFormData();
  return <BillForm data={data} />;
}

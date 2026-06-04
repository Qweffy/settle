import { getNewBillFormData } from '@/lib/queries/new-bill';
import { NewBillView } from './new-bill-view';

export const dynamic = 'force-dynamic';

export default async function NewBillPage() {
  const data = await getNewBillFormData();
  return <NewBillView data={data} />;
}

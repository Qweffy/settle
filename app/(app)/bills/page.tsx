import { getBillsData } from '@/lib/queries/bills';
import { BillsView } from './bills-view';

export const dynamic = 'force-dynamic';

export default async function BillsPage() {
  const data = await getBillsData();
  return <BillsView data={data} />;
}

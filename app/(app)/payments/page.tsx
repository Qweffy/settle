import { getPaymentsData } from '@/lib/queries/payments';
import { PaymentsView } from './payments-view';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const data = await getPaymentsData();
  return <PaymentsView data={data} />;
}

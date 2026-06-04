import { getAgingData } from '@/lib/queries/aging';
import { AgingView } from './aging-view';

export const dynamic = 'force-dynamic';

export default async function AgingPage() {
  const data = await getAgingData();
  return <AgingView data={data} />;
}

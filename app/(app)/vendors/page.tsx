import { getVendorsList } from '@/lib/queries/vendors-list';
import { VendorsListView } from './vendors-list-view';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const data = await getVendorsList();
  return <VendorsListView data={data} />;
}

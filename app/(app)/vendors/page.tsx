import { getVendorData } from '@/lib/queries/vendor';
import { VendorView } from './vendor-view';

export const dynamic = 'force-dynamic';

export default async function VendorPage() {
  const data = await getVendorData();
  return <VendorView data={data} />;
}

import { notFound } from 'next/navigation';
import { getVendorData } from '@/lib/queries/vendor';
import { VendorView } from './vendor-view';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getVendorData(id);
  if (!data) notFound();
  return <VendorView data={data} />;
}

import { notFound } from 'next/navigation';
import { getCockpitData } from '@/lib/queries/cockpit';
import { CockpitView } from './cockpit-view';

export const dynamic = 'force-dynamic';

export default async function BillCockpitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCockpitData(id);
  if (!data) notFound();
  return <CockpitView data={data} />;
}

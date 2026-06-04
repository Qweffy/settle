import { getCockpitData } from '@/lib/queries/cockpit';
import { CockpitView } from './cockpit-view';

export const dynamic = 'force-dynamic';

export default async function CockpitPage() {
  const data = await getCockpitData();
  return <CockpitView data={data} />;
}

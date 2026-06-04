import { getSettingsData } from '@/lib/queries/settings';
import { SettingsView } from './settings-view';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const data = await getSettingsData();
  return <SettingsView data={data} />;
}

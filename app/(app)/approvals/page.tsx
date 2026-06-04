import { getApprovalsData } from '@/lib/queries/approvals';
import { ApprovalsView } from './approvals-view';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const data = await getApprovalsData();
  return <ApprovalsView data={data} />;
}

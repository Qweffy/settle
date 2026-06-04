import '../styles/error-state.css';
import { ErrorState } from '@/components/error-state';

// 404 inside the shell — covers notFound() from bills/[id] and any unknown route.
// Returns a 404 status (Next handles that); the shell stays around the message.
export default function NotFound() {
  return (
    <ErrorState
      tone="neutral"
      icon="search-x"
      title="We couldn't find that page"
      body="The bill, vendor, or page you're after doesn't exist or was moved. It may have been deleted, or belong to a different entity."
      actions={[
        { label: 'Back to bills', href: '/bills', primary: true },
        { label: 'Go to dashboard', href: '/dashboard' },
      ]}
    />
  );
}

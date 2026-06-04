'use client';

import { useEffect } from 'react';
import '../styles/error-state.css';
import { ErrorState } from '@/components/error-state';

// Crash boundary for any page inside the shell — the sidebar + topbar stay, only
// the content area carries the message. Event-handler/async errors are handled by
// the actions' runAction wrapper; this catches render-time throws.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      tone="red"
      icon="alert-triangle"
      title="Something went wrong"
      body="This screen hit an unexpected error and stopped so it can't show you incorrect numbers. Your data is safe — nothing was saved or sent."
      actions={[
        { label: 'Reload screen', primary: true, onClick: () => unstable_retry() },
        { label: 'Report a problem', href: 'mailto:support@settle.app?subject=Settle%20error' },
      ]}
      meta={`Error ID ${error.digest ?? '—'} · logged automatically`}
    />
  );
}

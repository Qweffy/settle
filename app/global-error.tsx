'use client';

import { useEffect } from 'react';
import './globals.css';
import './styles/error-state.css';
import { ErrorState } from '@/components/error-state';

// Replaces the root layout when it (or a top-level provider) throws — so it must
// render its own <html>/<body> and pull in the global styles itself.
export default function GlobalError({
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
    <html lang="en">
      <body>
        <div className="estate-page">
          <ErrorState
            tone="red"
            icon="server-crash"
            title="Settle is having trouble"
            body="Something went wrong loading the app and this screen couldn't render. It's not your fault — the team has been notified. Try again in a moment."
            actions={[{ label: 'Try again', primary: true, onClick: () => unstable_retry() }]}
            meta={`Error ID ${error.digest ?? '—'} · logged automatically`}
          />
        </div>
      </body>
    </html>
  );
}

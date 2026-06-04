import './styles/error-state.css';
import { ErrorState } from '@/components/error-state';

// Root 404 for routes outside the app shell — full page.
export default function NotFound() {
  return (
    <div className="estate-page">
      <ErrorState
        tone="neutral"
        icon="search-x"
        title="Page not found"
        body="The page you're after doesn't exist. Head back to Settle to keep going."
        actions={[{ label: 'Go to Settle', href: '/dashboard', primary: true }]}
      />
    </div>
  );
}

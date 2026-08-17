import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '../components/ui';

export default function NotFound({ publicPage = false }: { publicPage?: boolean }) {
  const destination = publicPage ? '/' : '/dashboard';
  return <main className={publicPage ? 'standalone-not-found' : undefined}>
    <PageHeader title="Page not found" description="The address does not match an available PrivacyReady page." />
    <Card><EmptyState title="Nothing is available here" description="Check the address or return to a known workspace." action={<Link className="ui-button ui-button--primary" to={destination}>{publicPage ? 'Return home' : 'Back to dashboard'}</Link>} /></Card>
  </main>;
}

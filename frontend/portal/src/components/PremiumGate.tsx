import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Alert, Button, Card, Skeleton } from './ui';
import { usePortal } from '../contexts/PortalContext';

export default function PremiumGate({ children, title = 'This workspace requires a paid plan' }: { children: ReactNode; title?: string }) {
  const { isPremium, subscriptionLoading, subscriptionError, startCheckout } = usePortal();
  if (subscriptionLoading) return <Skeleton label="Checking subscription access" />;
  if (subscriptionError) return <Alert tone="danger">{subscriptionError} Premium content has not been requested.</Alert>;
  if (!isPremium) return <Card className="premium-gate"><LockKeyhole size={30} /><h2>{title}</h2><p>Upgrade to request this workspace. Premium records remain protected by server-side entitlement and organisation checks.</p><Button onClick={() => { void startCheckout(); }}>Compare paid plans</Button></Card>;
  return children;
}

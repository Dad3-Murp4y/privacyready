import type { ReactNode } from 'react';
import { Card, EmptyState, PageHeader, StatusBadge } from './ui';
import PremiumGate from './PremiumGate';

export default function OperationalWorkspace({ eyebrow, title, description, status = 'Coming soon', emptyTitle, emptyDescription, children }: { eyebrow: string; title: string; description: string; status?: 'Available' | 'Beta' | 'Coming soon'; emptyTitle: string; emptyDescription: string; children?: ReactNode }) {
  return <><PageHeader eyebrow={eyebrow} title={title} description={description} actions={<StatusBadge tone={status === 'Available' ? 'success' : status === 'Beta' ? 'warning' : 'neutral'}>{status}</StatusBadge>} /><PremiumGate><Card className="workspace-card">{children ?? <EmptyState title={emptyTitle} description={emptyDescription} />}</Card></PremiumGate></>;
}

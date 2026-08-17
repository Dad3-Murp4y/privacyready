import { Alert, Card, PageHeader, Skeleton } from '../components/ui';
import PremiumGate from '../components/PremiumGate';
import FindingList from '../components/findings/FindingList';
import { useScans } from '../hooks/useScans';
import { usePortal } from '../contexts/PortalContext';

export default function Findings() {
  const { isPremium, invalidatePremium } = usePortal();
  const { scans, loading, error } = useScans(isPremium, invalidatePremium);
  const latest = scans.find((scan) => scan.status === 'COMPLETED' && Array.isArray(scan.findingsJson));
  const findings = latest?.findingsJson ?? [];
  return <><PageHeader eyebrow="Remediation" title="Findings" description="Review actionable evidence from your latest completed scan." /><PremiumGate>{error && <Alert tone="danger">{error}</Alert>}{loading ? <Skeleton label="Loading findings" /> : <Card className="workspace-card"><div className="workspace-card__header"><div><h2>{latest ? `Latest scan: ${latest.targetIdentifier}` : 'Latest scan findings'}</h2>{latest && <p>{new Date(latest.createdAt).toLocaleDateString('en-GB')}</p>}</div></div><FindingList findings={findings} /></Card>}</PremiumGate></>;
}

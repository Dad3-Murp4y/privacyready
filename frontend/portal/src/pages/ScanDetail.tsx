import { Link, useParams } from 'react-router-dom';
import { Alert, Card, EmptyState, MetricCard, PageHeader, ScoreCard, Skeleton, StatusBadge } from '../components/ui';
import FindingList from '../components/findings/FindingList';
import PremiumGate from '../components/PremiumGate';
import { useScans } from '../hooks/useScans';
import { usePortal } from '../contexts/PortalContext';

export default function ScanDetail() {
  const { id } = useParams();
  const { isPremium, invalidatePremium } = usePortal();
  const { scans, loading, error } = useScans(true, invalidatePremium);
  const scan = scans.find((item) => item.id === id);
  if (loading) return <><PageHeader title="Scan details" /><Skeleton label="Loading scan details" /></>;
  if (error) return <><PageHeader title="Scan details" /><Alert tone="danger">{error}</Alert></>;
  if (!scan) return <><PageHeader title="Scan not found" description="This scan does not exist or is not available to your organisation." /><Card><EmptyState title="No scan available" description="Check the address or return to your organisation's scan history." action={<Link className="ui-button ui-button--secondary" to="/scans">Back to scans</Link>} /></Card></>;
  const findings = Array.isArray(scan.findingsJson) ? scan.findingsJson : [];
  const passed = findings.filter((finding) => finding.passed || finding.status === 'PASS').length;
  const open = findings.filter((finding) => !(finding.passed || finding.status === 'PASS'));
  const critical = open.filter((finding) => (finding.severity || '').toLowerCase() === 'critical').length;
  return <>
    <PageHeader eyebrow={`${scan.scanType} scan`} title={scan.targetIdentifier} description={new Date(scan.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} actions={<Link className="ui-button ui-button--secondary" to="/scans">All scans</Link>} />
    <div className="dashboard-grid"><ScoreCard score={scan.score} /><div className="metrics-row"><MetricCard label="Passed checks" value={isPremium ? passed : 'Premium'} /><MetricCard label="Issues detected" value={open.length} tone={open.length ? 'warning' : 'success'} /><MetricCard label="Critical findings" value={critical} tone={critical ? 'danger' : 'success'} /></div></div>
    <Card className="workspace-card"><div className="workspace-card__header"><div><h2>Scan status</h2><p>Recorded by the protected scanner service.</p></div><StatusBadge tone={scan.status === 'COMPLETED' ? 'success' : scan.status === 'FAILED' ? 'danger' : 'warning'}>{scan.status}</StatusBadge></div></Card>
    <PremiumGate title="Detailed scan findings require a paid plan"><Card className="workspace-card"><div className="workspace-card__header"><div><h2>Findings and remediation</h2><p>Evidence returned by this scan, ordered for review.</p></div></div><FindingList findings={findings} /></Card></PremiumGate>
  </>;
}

import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, Card, EmptyState, MetricCard, PageHeader, ScoreCard, Skeleton, StatusBadge } from '../components/ui';
import { useScans } from '../hooks/useScans';
import { usePortal } from '../contexts/PortalContext';

export default function Dashboard() {
  const { isPremium, invalidatePremium } = usePortal();
  const { scans, loading, error } = useScans(true, invalidatePremium);
  const completed = scans.filter((scan) => scan.status === 'COMPLETED');
  const latest = completed[0];
  const previous = completed[1];
  const findings = Array.isArray(latest?.findingsJson) ? latest.findingsJson : [];
  const open = findings.filter((finding) => !(finding.passed || finding.status === 'PASS'));
  const critical = open.filter((finding) => (finding.severity || '').toLowerCase() === 'critical');
  const passed = findings.filter((finding) => finding.passed || finding.status === 'PASS').length;

  return <>
    <PageHeader eyebrow="Compliance command centre" title="What needs your attention" description="Prioritise real findings, review scan changes, and move your next compliance actions forward." actions={<Link className="ui-button ui-button--primary" to="/scans">Run new scan</Link>} />
    {error && <Alert tone="danger">{error}</Alert>}
    {loading ? <Skeleton label="Loading dashboard scans" /> : !latest ? <Card><EmptyState title="Your workspace is ready" description="Run a website scan to establish your first privacy-readiness score and attention queue." action={<Link className="ui-button ui-button--primary" to="/scans">Run new scan</Link>} /></Card> : <div className="dashboard-grid">
      <ScoreCard score={latest.score} change={typeof latest.score === 'number' && typeof previous?.score === 'number' ? latest.score - previous.score : undefined} />
      <div className="metrics-row"><MetricCard label="Critical findings" value={critical.length} detail="From the latest scan" icon={<ShieldAlert size={19} />} tone={critical.length ? 'danger' : 'success'} /><MetricCard label="Needs review" value={open.length} detail="Open scan findings" icon={<AlertTriangle size={19} />} tone={open.length ? 'warning' : 'success'} /><MetricCard label="Passed checks" value={passed} detail="Latest scan evidence" icon={<CheckCircle2 size={19} />} tone="success" /></div>
      <Card className="dashboard-section dashboard-span-7"><div className="dashboard-section__header"><div><h2>Priority actions</h2><p>Findings returned by your latest scan.</p></div><Link to={`/scans/${latest.id}`}>Open scan</Link></div>{open.length ? isPremium ? <div className="activity-list">{open.slice(0, 5).map((finding, index) => <div className="activity-item" key={`${finding.finding_type}-${index}`}><div><strong>{finding.finding_type?.replaceAll('_', ' ') || finding.title || 'Finding'}</strong><span>{finding.description || finding.detail || 'Review required'}</span></div><StatusBadge tone={['critical', 'high'].includes((finding.severity || '').toLowerCase()) ? 'danger' : 'warning'}>{finding.severity || 'Review'}</StatusBadge></div>)}</div> : <div className="premium-summary"><p><strong>{open.length} {open.length === 1 ? 'issue' : 'issues'} detected.</strong> Upgrade to view findings and remediation guidance.</p><Link className="ui-button ui-button--primary" to="/findings">View upgrade options</Link></div> : <EmptyState title="No priority actions" description="The latest scan did not return actionable findings." />}</Card>
      <Card className="dashboard-section dashboard-span-5"><div className="dashboard-section__header"><div><h2>Recent scans</h2><p>Your latest recorded checks.</p></div><Activity size={18} /></div><div className="activity-list">{scans.slice(0, 5).map((scan) => <div className="activity-item" key={scan.id}><div><strong>{scan.targetIdentifier}</strong><span>{new Date(scan.createdAt).toLocaleDateString('en-GB')}</span></div><StatusBadge tone={scan.status === 'COMPLETED' ? 'success' : scan.status === 'FAILED' ? 'danger' : 'warning'}>{typeof scan.score === 'number' ? `${scan.score}/100` : scan.status}</StatusBadge></div>)}</div></Card>
    </div>}
  </>;
}

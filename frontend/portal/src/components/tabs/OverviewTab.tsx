import { AlertTriangle, CheckCircle2, ClipboardCheck, LockKeyhole, Search, ShieldAlert } from 'lucide-react';
import { Button, Card, EmptyState, FindingCard, MetricCard, PriorityAction, ScoreCard, StatusBadge } from '../ui';

type AuditCheck = { name: string; passed: boolean; details: string };
type Audit = { id: string; target: string; date: string; score: number; status: string; checks?: AuditCheck[] };
type Task = { id: string; title: string; details: string; auditTarget: string; priority: string; completed: boolean };
type Props = {
  overallScore: number;
  audits: Audit[];
  remediationTasks: Task[];
  handleToggleTask: (id: string) => void;
  hasSubscription: boolean;
  handleStripeCheckout: (plan: 'starter' | 'growth') => void;
  onViewScans: () => void;
};

export default function OverviewTab({ overallScore, audits, remediationTasks, handleToggleTask, hasSubscription, handleStripeCheckout, onViewScans }: Props) {
  const latest = audits[0];
  const previous = audits[1];
  const change = latest && previous ? latest.score - previous.score : 0;
  const checks = latest?.checks ?? [];
  const critical = checks.filter((check) => !check.passed && /critical|high|missing|fail/i.test(`${check.name} ${check.details}`));
  const review = checks.filter((check) => !check.passed && !critical.includes(check));
  const passed = checks.filter((check) => check.passed).length;
  const websiteStatus = !latest ? 'Not assessed' : checks.some((check) => !check.passed) ? 'Needs review' : 'Good';
  const categories = [
    { title: 'Website privacy signals', status: websiteStatus },
    { title: 'Privacy governance', status: 'Not assessed' },
    { title: 'Data subject rights', status: 'Not assessed' },
    { title: 'Data retention and minimisation', status: 'Not assessed' },
    { title: 'Third-party processors', status: 'Not assessed' },
    { title: 'Breach readiness', status: 'Not assessed' },
    { title: 'Staff awareness', status: 'Not assessed' },
    { title: 'Technical safeguards', status: 'Not assessed' },
  ];

  return <div className="dashboard-grid">
    <ScoreCard score={overallScore} change={change} />
    <div className="metrics-row">
      <MetricCard label="Critical findings" value={critical.length} detail="Require immediate attention" icon={<ShieldAlert size={19} />} tone={critical.length ? 'danger' : 'success'} />
      <MetricCard label="Needs review" value={review.length} detail="Validate or remediate" icon={<AlertTriangle size={19} />} tone={review.length ? 'warning' : 'success'} />
      <MetricCard label="Passed controls" value={passed} detail={`Across ${audits.length} recorded scan${audits.length === 1 ? '' : 's'}`} icon={<CheckCircle2 size={19} />} tone="success" />
    </div>

    <Card className="dashboard-section dashboard-span-7">
      <div className="dashboard-section__header"><div><h2>Priority findings</h2><p>Issues from the latest server-provided scan response.</p></div><Button variant="ghost" onClick={onViewScans}>View scans</Button></div>
      {checks.length === 0 ? <EmptyState title="No findings to review" description="Run a website or asset scan to populate your attention queue." action={<Button onClick={onViewScans}><Search size={16} /> Run a scan</Button>} /> : <div className="finding-list">{[...critical, ...review].slice(0, 4).map((check) => <FindingCard key={`${check.name}-${check.details}`} title={check.name} description={check.details} severity={critical.includes(check) ? 'danger' : 'warning'} />)}</div>}
    </Card>

    <Card className="dashboard-section dashboard-span-5">
      <div className="dashboard-section__header"><div><h2>Priority actions</h2><p>Turn findings into an actionable worklist.</p></div><StatusBadge tone="info">{remediationTasks.filter((task) => !task.completed).length} open</StatusBadge></div>
      {remediationTasks.length ? <div className="action-list">{remediationTasks.slice(0, 5).map((task) => <PriorityAction key={task.id} title={task.title} description={`${task.auditTarget} · ${task.details}`} complete={task.completed} onToggle={() => handleToggleTask(task.id)} />)}</div> : <EmptyState title="No actions generated" description="Remediation actions appear after findings are recorded." />}
    </Card>

    <Card className="dashboard-section paywall-panel dashboard-span-7">
      {hasSubscription ? <><div className="dashboard-section__header"><div><h2>Compliance category status</h2><p>Only assessed evidence is labelled. Unmeasured areas remain clearly marked.</p></div></div><div className="category-list">{categories.map((category) => <div className="category-status" key={category.title}><span>{category.title}</span><StatusBadge tone={category.status === 'Good' ? 'success' : category.status === 'Needs review' ? 'warning' : 'neutral'}>{category.status}</StatusBadge></div>)}</div></> : <div className="paywall-panel__locked"><div><LockKeyhole size={30} /><h2>Detailed category analysis is a Pro feature</h2><p>The backend remains authoritative for premium findings and evidence. Upgrade to request the full category breakdown and remediation workspace.</p><Button onClick={() => handleStripeCheckout('starter')}>Compare Pro plans</Button></div></div>}
    </Card>

    <Card className="dashboard-section dashboard-span-5">
      <div className="dashboard-section__header"><div><h2>Recent scans</h2><p>Your latest compliance checks.</p></div><ClipboardCheck size={19} /></div>
      {audits.length ? <div className="activity-list">{audits.slice(0, 5).map((audit) => <div className="activity-item" key={audit.id}><div><strong>{audit.target}</strong><br /><span>{audit.date}</span></div><StatusBadge tone={audit.score >= 80 ? 'success' : 'warning'}>{audit.score}/100</StatusBadge></div>)}</div> : <EmptyState title="No recent scans" description="Your completed scans will appear here." />}
    </Card>
  </div>;
}

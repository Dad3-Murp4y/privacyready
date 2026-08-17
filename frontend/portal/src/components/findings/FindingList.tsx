import { EmptyState, FindingCard } from '../ui';
import type { ScanFinding } from '../../types/portal';

const severity = (finding: ScanFinding): 'danger' | 'warning' | 'info' => {
  const value = (finding.severity || '').toLowerCase();
  if (value === 'critical' || value === 'high') return 'danger';
  if (value === 'medium') return 'warning';
  return 'info';
};

export default function FindingList({ findings }: { findings: ScanFinding[] }) {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const actionable = findings.filter((finding) => !(finding.passed || finding.status === 'PASS')).toSorted((left, right) => (order[(left.severity || '').toLowerCase()] ?? 4) - (order[(right.severity || '').toLowerCase()] ?? 4));
  if (!actionable.length) return <EmptyState title="No open findings" description="No actionable findings were returned for this scan." />;
  return <div className="finding-list">{actionable.map((finding, index) => <FindingCard key={`${finding.finding_type || finding.title}-${index}`} title={finding.title || finding.finding_type?.replaceAll('_', ' ') || 'Finding'} description={finding.description || finding.detail || 'Review this finding in the scan evidence.'} severity={severity(finding)} badgeLabel={finding.severity ? finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1).toLowerCase() : 'Review'} />)}</div>;
}

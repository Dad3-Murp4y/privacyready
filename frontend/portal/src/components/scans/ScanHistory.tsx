import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, EmptyState, StatusBadge } from '../ui';
import type { ScanRecord } from '../../types/portal';

const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ScanHistory({ scans }: { scans: ScanRecord[] }) {
  if (!scans.length) return <Card><EmptyState title="No scans yet" description="Run your first website scan to create a real privacy-readiness record." /></Card>;
  return <Card className="workspace-card"><div className="table-scroll"><table className="ui-table scan-table"><thead><tr><th>Target</th><th>Type</th><th>Date</th><th>Score</th><th>Status</th><th>Findings</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{scans.map((scan) => { const findings = Array.isArray(scan.findingsJson) ? scan.findingsJson.length : 0; return <tr key={scan.id}><td data-label="Target"><strong className="wrap-content">{scan.targetIdentifier}</strong></td><td data-label="Type">{scan.scanType}</td><td data-label="Date">{date(scan.createdAt)}</td><td data-label="Score">{typeof scan.score === 'number' ? `${scan.score}/100` : 'Not scored'}</td><td data-label="Status"><StatusBadge tone={scan.status === 'COMPLETED' ? 'success' : scan.status === 'FAILED' ? 'danger' : 'warning'}>{scan.status.toLowerCase().replaceAll('_', ' ')}</StatusBadge></td><td data-label="Findings">{findings}</td><td><Link className="ui-button ui-button--ghost" to={`/scans/${scan.id}`} aria-label={`View scan for ${scan.targetIdentifier}`}>View <ExternalLink size={15} /></Link></td></tr>; })}</tbody></table></div></Card>;
}

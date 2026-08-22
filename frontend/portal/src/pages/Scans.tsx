import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Alert, Button, Card, Input, PageHeader, Select, Skeleton } from '../components/ui';
import ScanHistory from '../components/scans/ScanHistory';
import { useScans } from '../hooks/useScans';
import { usePortal } from '../contexts/PortalContext';

export default function Scans() {
  const { invalidatePremium } = usePortal();
  const { scans, setScans, loading, error, refresh } = useScans(true, invalidatePremium);
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState('website');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setSubmitError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/scan`, { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetIdentifier: target, scanType }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The scan could not be completed.');
      setScans((current) => [data, ...current]); setTarget('');
    } catch (caught) { setSubmitError(caught instanceof Error ? caught.message : 'The scan could not be completed.'); }
    finally { setSubmitting(false); }
  };
  const completed = scans.filter((scan) => scan.status === 'COMPLETED');
  const latest = completed[0]; const previous = completed[1];
  const open = Array.isArray(latest?.findingsJson) ? latest.findingsJson.filter((finding) => !(finding.passed || finding.status === 'PASS')).length : 0;
  return <>
    <PageHeader eyebrow="Digital properties" title="Website scans" description="Run and review privacy scans across your digital properties." actions={<Button variant="secondary" onClick={() => { void refresh(); }}><RefreshCw size={16} /> Refresh</Button>} />
    <Card className="workspace-card"><form className="scan-form" onSubmit={submit}><div><label htmlFor="scan-type">Scan type</label><Select id="scan-type" value={scanType} onChange={(event) => setScanType(event.target.value)}><option value="website">Website</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="whatsapp">WhatsApp</option><option value="google_analytics">Google Analytics 4</option></Select></div><div className="scan-form__target"><label htmlFor="scan-target">Target</label><Input id="scan-target" value={target} onChange={(event) => setTarget(event.target.value)} required placeholder="https://example.co.uk" /></div><Button type="submit" disabled={submitting} aria-busy={submitting}><Plus size={16} /> {submitting ? 'Running scan' : 'Run new scan'}</Button></form>{submitError && <Alert tone="danger">{submitError}</Alert>}</Card>
    {latest && <div className="summary-strip"><div><span>Latest score</span><strong>{typeof latest.score === 'number' ? `${latest.score}/100` : 'Not scored'}</strong></div><div><span>Last scan</span><strong>{new Date(latest.createdAt).toLocaleDateString('en-GB')}</strong></div><div><span>Open findings</span><strong>{open}</strong></div><div><span>Change</span><strong>{typeof latest.score === 'number' && typeof previous?.score === 'number' ? `${latest.score - previous.score >= 0 ? '+' : ''}${latest.score - previous.score}` : 'Not available'}</strong></div></div>}
    {error && <Alert tone="danger">{error}</Alert>}{loading ? <Skeleton label="Loading scan history" /> : <ScanHistory scans={scans} />}
  </>;
}

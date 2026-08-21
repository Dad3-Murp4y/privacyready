import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, Input, StatusBadge } from '../components/ui';

type Finding = { finding_type?: string; severity?: string; description?: string };
type PublicScan = { id: string; targetIdentifier: string; score: number | null; findingsJson: Finding[]; claimToken: string };

export default function PublicScanner({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [scan, setScan] = useState<PublicScan | null>(null);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const keepClaim = (destination: '/register?source=free-scan' | '/login') => {
    if (!scan) return;
    sessionStorage.setItem('freeScanId', scan.id);
    sessionStorage.setItem('freeScanClaimToken', scan.claimToken);
    sessionStorage.setItem('freeScanUrl', scan.targetIdentifier);
    sessionStorage.setItem('freeScanScore', String(scan.score ?? 0));
    navigate(destination);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setScan(null); setIsScanning(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/public/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetIdentifier: target, scanType: 'website' }), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The scan could not be completed.');
      setScan(data);
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === 'AbortError' ? 'The scan timed out. Please check the address and try again.' : caught instanceof Error ? caught.message : 'The scan could not be completed.');
    } finally { window.clearTimeout(timeout); setIsScanning(false); }
  };

  const findings = scan?.findingsJson ?? [];
  const content = <Card className="public-scanner">
    <div className="public-scanner__header"><p className="eyebrow">Free website scan</p>{embedded ? <h2>Check your website privacy signals</h2> : <h1>Check your website privacy signals</h1>}<p>This automated review uses the live PrivacyReady scanner. It is not legal advice or a compliance guarantee.</p></div>
    <form className="public-scanner__form" onSubmit={submit}><label className="sr-only" htmlFor="public-scan-target">Website address</label><Input id="public-scan-target" type="url" inputMode="url" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="https://example.co.uk" required disabled={isScanning} /><Button type="submit" disabled={isScanning} aria-busy={isScanning}>{isScanning ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}{isScanning ? 'Scanning website' : 'Run free GDPR scan'}</Button></form>
    <span className="sr-only" role="status" aria-live="polite">{isScanning ? 'Website scan in progress.' : scan ? 'Website scan completed.' : ''}</span>
    {error && <Alert tone="danger"><AlertCircle size={16} /> {error}</Alert>}
    {scan && <section className="public-scanner__result" aria-live="polite"><p className="muted">Results for <strong>{scan.targetIdentifier}</strong></p><div className="public-scanner__metrics"><div><span className="public-scanner__score">{scan.score ?? 0}</span><span className="muted"> / 100</span></div><StatusBadge tone={findings.length ? 'warning' : 'success'}>{findings.length ? `${findings.length} potential issue${findings.length === 1 ? '' : 's'}; review recommended` : 'No potential issues found in this scan'}</StatusBadge></div><div className="public-scanner__findings">{findings.slice(0, 3).map((finding, index) => <div className="public-scanner__finding" key={`${finding.finding_type}-${index}`}><strong>{finding.finding_type?.replaceAll('_', ' ') || 'Requires review'}</strong><p>{finding.description || 'Review this signal in your full report.'}</p></div>)}</div><div className="public-scanner__actions"><Button onClick={() => keepClaim('/register?source=free-scan')}>View full report <ArrowRight size={17} /></Button><Button variant="secondary" onClick={() => keepClaim('/login')}>Already have an account? Sign in</Button></div></section>}
  </Card>;
  return embedded ? content : <main className="standalone-scanner">{content}</main>;
}

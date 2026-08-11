import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

type Finding = { finding_type?: string; severity?: string; description?: string };
type PublicScan = {
  id: string;
  targetIdentifier: string;
  score: number | null;
  findingsJson: Finding[];
  claimToken: string;
};

export default function PublicScanner() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [scan, setScan] = useState<PublicScan | null>(null);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const keepClaimForRegistration = () => {
    if (!scan) return;
    // The opaque claim token is deliberately kept out of URLs, referrers and
    // browser history. The API still verifies its hash and one-time expiry.
    sessionStorage.setItem('freeScanId', scan.id);
    sessionStorage.setItem('freeScanClaimToken', scan.claimToken);
    sessionStorage.setItem('freeScanUrl', scan.targetIdentifier);
    sessionStorage.setItem('freeScanScore', String(scan.score ?? 0));
    navigate('/register?source=free-scan');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setScan(null);
    setIsScanning(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/public/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIdentifier: target, scanType: 'website' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The scan could not be completed.');
      setScan(data);
    } catch (err: any) {
      setError(err.message || 'The scan could not be completed.');
    } finally {
      setIsScanning(false);
    }
  };

  const findings = scan?.findingsJson ?? [];
  const severityCount = (severity: string) => findings.filter((finding) => finding.severity?.toLowerCase() === severity).length;

  return (
    <main className="auth-container" style={{ minHeight: '100vh', padding: '48px 20px' }}>
      <div className="auth-glow" />
      <section className="auth-card" style={{ maxWidth: '780px', width: '100%' }}>
        <div className="auth-header">
          <ShieldCheck size={52} color="var(--sky)" strokeWidth={1.5} />
          <h1 className="auth-title">Privacy Ready</h1>
          <p className="auth-subtitle">Check your website for potential privacy issues. This is an automated website review, not legal advice or a compliance guarantee.</p>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: 1, minWidth: '250px' }} value={target} onChange={(event) => setTarget(event.target.value)} placeholder="https://example.co.uk" required disabled={isScanning} />
          <button className="btn btn-primary" type="submit" disabled={isScanning}>
            {isScanning ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            {isScanning ? 'Scanning…' : 'Scan my website'}
          </button>
        </form>
        {error && <p style={{ marginTop: '18px', color: '#fca5a5', display: 'flex', gap: '8px', alignItems: 'center' }}><AlertCircle size={18} />{error}</p>}
        {scan && (
          <section style={{ marginTop: '28px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Results for <strong>{scan.targetIdentifier}</strong></p>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap', margin: '18px 0' }}>
              <div><div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Privacy score</div><strong style={{ fontSize: '42px', color: 'var(--sky)' }}>{scan.score ?? 0}<small style={{ fontSize: '18px' }}>/100</small></strong></div>
              <div><strong style={{ fontSize: '28px' }}>{findings.length}</strong><div style={{ color: 'var(--text-secondary)' }}>potential issues found</div></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['high', 'medium', 'low'] as const).map((severity) => <span key={severity} style={{ textTransform: 'capitalize', color: severity === 'high' ? '#fca5a5' : severity === 'medium' ? '#fcd34d' : '#93c5fd' }}>{severityCount(severity)} {severity}</span>)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {findings.slice(0, 4).map((finding, index) => <div key={`${finding.finding_type}-${index}`} style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '10px' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--sky)' }} /><strong>{finding.finding_type?.replaceAll('_', ' ')}</strong><p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{finding.description}</p></div>)}
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: '22px' }}>Create an account to view the complete report, evidence and remediation guidance.</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={keepClaimForRegistration}>View full report <ArrowRight size={18} /></button>
              <button className="btn" onClick={() => navigate('/login')}>Sign in</button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

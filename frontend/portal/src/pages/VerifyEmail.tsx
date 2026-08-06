import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function VerifyEmail() {
  const [status, setStatus] = useState<'ready' | 'verifying' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const uid = params.get('uid');
  const linkIsValid = Boolean(token && uid);

  // Verification now requires an explicit click (POST), not just opening
  // the link (which used to be a GET fired automatically on page load).
  // That auto-fire meant mail-scanner link prefetching could silently
  // consume the one-time token before the real user ever saw this page.
  const handleConfirm = async () => {
    if (status === 'verifying' || status === 'success') return; // guard against double-click
    setStatus('verifying');

    try {
      const res = await fetch(`${API}/api/auth/verify-email`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Verification failed.');
        return;
      }
      setStatus('success');
      setMessage(data.message || 'Email verified.');
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            {(status === 'ready' || status === 'verifying') && <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />}
            {status === 'success' && <CheckCircle2 size={48} color="#27AE60" strokeWidth={1.5} />}
            {status === 'error' && <XCircle size={48} color="#C0392B" strokeWidth={1.5} />}
          </div>
          <h1 className="auth-title">
            {status === 'ready' && 'Confirm your email'}
            {status === 'verifying' && 'Verifying your email...'}
            {status === 'success' && 'Email verified'}
            {status === 'error' && 'Verification failed'}
          </h1>
          <p className="auth-subtitle">
            {status === 'ready' && linkIsValid && 'Click below to confirm this is really you.'}
            {status === 'ready' && !linkIsValid && 'This verification link is missing required information.'}
            {status !== 'ready' && message}
          </p>
        </div>

        {status === 'ready' && linkIsValid && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleConfirm}>
            Confirm my email
          </button>
        )}

        {(status === 'success' || status === 'error') && (
          <div className="auth-footer">
            <a href="/login">Go to log in</a>
          </div>
        )}
      </div>
    </div>
  );
}

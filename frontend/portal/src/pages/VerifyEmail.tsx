import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function VerifyEmail() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const uid = params.get('uid');

    if (!token || !uid) {
      setStatus('error');
      setMessage('This verification link is missing required information.');
      return;
    }

    fetch(`${API}/api/auth/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
          return;
        }
        setStatus('success');
        setMessage(data.message || 'Email verified.');
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please try again.');
      });
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            {status === 'verifying' && <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />}
            {status === 'success' && <CheckCircle2 size={48} color="#27AE60" strokeWidth={1.5} />}
            {status === 'error' && <XCircle size={48} color="#C0392B" strokeWidth={1.5} />}
          </div>
          <h1 className="auth-title">
            {status === 'verifying' && 'Verifying your email...'}
            {status === 'success' && 'Email verified'}
            {status === 'error' && 'Verification failed'}
          </h1>
          <p className="auth-subtitle">{message}</p>
        </div>
        {status !== 'verifying' && (
          <div className="auth-footer">
            <a href="/login">Go to log in</a>
          </div>
        )}
      </div>
    </div>
  );
}

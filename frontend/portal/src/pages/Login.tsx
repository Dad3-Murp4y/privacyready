import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Home, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const navigate = useNavigate();

  // Forgot password states
  const [isForgot, setIsForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.role) {
          if (data.role === 'SUPERADMIN') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUnverified(false);
    setResendStatus('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        // Authentication is now fully handled via HTTP-only cookies
        
        try {
          if (data.payload && data.payload.role === 'SUPERADMIN') {
            navigate('/admin');
            return;
          }
        } catch(e) {}
        
        const claimToken = sessionStorage.getItem('freeScanClaimToken');
        if (claimToken) {
          const claim = await fetch(`${import.meta.env.VITE_API_URL}/api/scan/claim`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimToken })
          });
          sessionStorage.removeItem('freeScanClaimToken');
          sessionStorage.removeItem('freeScanId');
          if (!claim.ok) sessionStorage.setItem('scanClaimError', 'Your free scan could not be claimed. Run a new scan from the dashboard.');
        }
        navigate('/dashboard');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Invalid credentials');
        if (res.status === 403 && errData.error?.includes('verify your email')) {
          setIsUnverified(true);
        }
      }
    } catch (err) {
      console.error('Login failed', err);
      setError('The system is currently offline for maintenance. Please try again later.');
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendStatus('Sending…');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/resend-verification`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setResendStatus('Verification link sent. Check your inbox.');
      } else {
        setResendStatus('Failed to resend. Please try again later.');
      }
    } catch (err) {
      setResendStatus('The system is currently offline for maintenance. Please try again later.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetEmail) {
      setResetSent(true);
    }
  };

  const handleBackToSignIn = () => {
    setIsForgot(false);
    setResetSent(false);
    setResetEmail('');
  };

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 10 }}>
        <a href={import.meta.env.VITE_MARKETING_URL} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit' }}>
          <Home size={18} /> Back to home
        </a>
      </div>
      <div className="auth-card">
        
        {/* FORGOT PASSWORD - SUCCESS STATE */}
        {isForgot && resetSent ? (
          <div style={{ animation: 'fadeUp 0.4s ease-out both' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', color: '#4ade80' }}>
              <CheckCircle2 size={64} strokeWidth={1.5} />
            </div>
            <div className="auth-header">
              <h1 className="auth-title">Reset unavailable</h1>
              <p className="auth-subtitle" style={{ lineHeight: '1.5' }}>
                Password reset email is not currently connected, so no message has been sent to <strong>{resetEmail}</strong>. Contact <a href="mailto:hello@privacyready.co.uk">hello@privacyready.co.uk</a> for account support.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleBackToSignIn} style={{ width: '100%', marginTop: '24px' }}>
              Back to sign in
            </button>
          </div>
        ) : isForgot ? (
          /* FORGOT PASSWORD - REQUEST FORM */
          <div style={{ animation: 'fadeUp 0.4s ease-out both' }}>
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
              </div>
              <h1 className="auth-title">Reset password</h1>
              <p className="auth-subtitle">Password reset email is not currently connected. Enter your email to view account-support guidance.</p>
            </div>

            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Email address</label>
                <input 
                  id="reset-email"
                  type="email" 
                  className="form-input" 
                  placeholder="you@company.com" 
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Continue <ArrowRight size={18} />
              </button>
            </form>

            <div className="auth-footer">
              <a href="#" onClick={(e) => { e.preventDefault(); handleBackToSignIn(); }}>Back to sign in</a>
            </div>
          </div>
        ) : (
          /* STANDARD SIGN IN FORM */
          <div style={{ animation: 'fadeUp 0.4s ease-out both' }}>
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
              </div>
              <h1 className="auth-title">Welcome back</h1>
              <p className="auth-subtitle">Log in to manage your GDPR compliance</p>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
                {isUnverified && (
                  <div style={{ marginTop: '12px' }}>
                    <button 
                      type="button"
                      onClick={handleResendVerification}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', width: '100%' }}
                    >
                      Resend verification email
                    </button>
                    {resendStatus && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--sky)' }}>{resendStatus}</div>}
                  </div>
                )}
              </div>
            )}

            <form className="auth-form" onSubmit={handleLogin} autoComplete="off">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email address</label>
                <input 
                  id="login-email"
                  type="email" 
                  className="form-input" 
                  placeholder="you@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Password</span>
                  <a href="#" onClick={(e) => { e.preventDefault(); setIsForgot(true); }} style={{ fontSize: '12px', textTransform: 'none' }}>Forgot password?</a>
                </label>
                <input 
                  id="login-password"
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Sign in <ArrowRight size={18} />
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account? <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Create account</a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Home } from 'lucide-react';

const passwordMeetsRegistrationPolicy = (value: string) =>
  value.length >= 8 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^a-zA-Z\d]/.test(value);

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length > 7) score += 25;
    if (pass.match(/[a-z]/) && pass.match(/[A-Z]/)) score += 25;
    if (pass.match(/[0-9]/)) score += 25;
    if (pass.match(/[^a-zA-Z0-9]/)) score += 25;
    return score;
  };
  const strength = calculatePasswordStrength(password);
  
  let strengthColor = 'var(--text-muted)';
  let strengthLabel = 'Too short';
  if (password.length > 0) {
    if (strength <= 25) { strengthColor = '#ef4444'; strengthLabel = 'Weak'; }
    else if (strength <= 50) { strengthColor = '#f59e0b'; strengthLabel = 'Fair'; }
    else if (strength <= 75) { strengthColor = '#10b981'; strengthLabel = 'Good'; }
    else { strengthColor = '#059669'; strengthLabel = 'Strong'; }
  }

  useEffect(() => {
    // Earlier builds copied this bearer credential into persistent storage.
    // Remove any legacy copy; current claims remain scoped to this browser tab.
    localStorage.removeItem('freeScanClaimToken');
    localStorage.removeItem('freeScanId');
    const queryParams = new URLSearchParams(window.location.search);
    const source = queryParams.get('source');
    const scanUrlRaw = sessionStorage.getItem('freeScanUrl') || queryParams.get('url');
    const scanScoreRaw = sessionStorage.getItem('freeScanScore') || queryParams.get('score');
    const scanIdRaw = sessionStorage.getItem('freeScanId') || queryParams.get('scanId');
    // Claim tokens are bearer credentials and must never be accepted from a
    // URL. The public scanner stores the token in same-tab sessionStorage.
    const scanClaimTokenRaw = sessionStorage.getItem('freeScanClaimToken');

    // Validate before storing -- these come straight from the URL, which
    // is attacker-controllable (a crafted link), so each value is checked
    // for a sane shape rather than trusted as-is.
    const isValidHttpUrl = (value: string | null): value is string => {
      if (!value) return false;
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };
    const isValidScore = (value: string | null) => {
      if (!value) return false;
      const n = Number(value);
      return Number.isInteger(n) && n >= 0 && n <= 100;
    };
    const isValidUuid = (value: string | null): value is string =>
      !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const isValidClaimToken = (value: string | null): value is string =>
      !!value && /^[0-9a-f]{64}$/i.test(value); // 32 random bytes, hex-encoded

    if (source === 'free-scan' && isValidHttpUrl(scanUrlRaw)) {
      localStorage.setItem('freeScanUrl', scanUrlRaw);
      localStorage.setItem('freeScanScore', isValidScore(scanScoreRaw) ? scanScoreRaw! : '75');
      if (!isValidUuid(scanIdRaw)) sessionStorage.removeItem('freeScanId');
      if (!isValidClaimToken(scanClaimTokenRaw)) sessionStorage.removeItem('freeScanClaimToken');
    }

    
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    // Match the server-side registration schema before sending credentials.
    // The server remains authoritative; this avoids an opaque Fastify 400 for
    // legitimate users while preserving the existing complexity policy.
    if (!passwordMeetsRegistrationPolicy(password)) {
      setError('Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a symbol.');
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
      credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          organizationName: orgName,
          scanId: sessionStorage.getItem('freeScanId') || undefined,
          scanClaimToken: sessionStorage.getItem('freeScanClaimToken') || undefined
        })
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 400 && typeof data.message === 'string' && data.message.includes('password')) {
          throw new Error('Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a symbol.');
        }
        throw new Error(data.message || data.error || 'Registration failed');
      }
      
      localStorage.removeItem('freeScanId');
      localStorage.removeItem('freeScanClaimToken');
      sessionStorage.removeItem('freeScanId');
      sessionStorage.removeItem('freeScanClaimToken');
      sessionStorage.removeItem('freeScanUrl');
      sessionStorage.removeItem('freeScanScore');
      setRegistered(true);
    } catch (err: any) {
      if (err.message === 'Failed to fetch' || err.message === 'NetworkError when attempting to fetch resource.') {
        setError('⚠️ System is currently offline for maintenance. Please try again later.');
      } else {
        setError(err.message || 'Registration failed');
      }
    }
  };

  if (registered) {
    return (
      <div className="auth-container">
        <div className="auth-glow" />
        <div className="auth-card">
          <div className="auth-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
            </div>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We've sent a verification link to <strong>{email}</strong>. Click it to activate your account, then log in.
            </p>
          </div>
          <div className="auth-footer">
            <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Back to log in</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 10 }}>
        <a href={import.meta.env.VITE_MARKETING_URL} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit' }}>
          <Home size={18} /> Back to Home
        </a>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your GDPR compliance journey</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleRegister} autoComplete="off">
          <div className="form-group">
            <label className="form-label" htmlFor="register-full-name">Full Name</label>
            <input 
              id="register-full-name"
              type="text" 
              className="form-input" 
              placeholder="John Doe" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="register-organisation">Organisation Name</label>
            <input 
              id="register-organisation"
              type="text" 
              className="form-input" 
              placeholder="Acme Corp" 
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email Address</label>
            <input 
              id="register-email"
              type="email" 
              className="form-input" 
              placeholder="you@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="register-password" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Password
              {password && <span style={{ fontSize: '11px', fontWeight: 600, color: strengthColor }}>{strengthLabel}</span>}
            </label>
            <input 
              id="register-password"
              type="password" 
              className="form-input" 
              placeholder="Min. 8 characters" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required 
            />
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.4 }}>
              Use 8 or more characters with uppercase and lowercase letters, a number, and a symbol.
            </p>
            {password && (
              <div style={{ height: '4px', background: 'var(--glass-border)', marginTop: '8px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(10, strength)}%`, background: strengthColor, transition: 'all 0.3s ease' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px' }}>
            <input 
              type="checkbox" 
              id="terms" 
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <label htmlFor="terms" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.5' }}>
              I agree to the <a href="https://privacyready.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sky)', textDecoration: 'none' }}>Terms of Service</a> and <a href="https://privacyready.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sky)', textDecoration: 'none' }}>Privacy Policy</a>, and I acknowledge that PrivacyReady is a compliance management tool, not legal advice.
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={!termsAccepted}>
            Create Account <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log in</a>
        </div>
      </div>
    </div>
  );
}

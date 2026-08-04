import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Home } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams(window.location.search);
    const source = queryParams.get('source');
    const scanUrlRaw = queryParams.get('url');
    const scanScoreRaw = queryParams.get('score');
    const scanIdRaw = queryParams.get('scanId');
    const scanClaimTokenRaw = queryParams.get('scanClaimToken');

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
      if (isValidUuid(scanIdRaw)) localStorage.setItem('freeScanId', scanIdRaw);
      if (isValidClaimToken(scanClaimTokenRaw)) localStorage.setItem('freeScanClaimToken', scanClaimTokenRaw);
    }

    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          organizationName: orgName,
          scanId: localStorage.getItem('freeScanId') || undefined,
          scanClaimToken: localStorage.getItem('freeScanClaimToken') || undefined
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      localStorage.removeItem('freeScanId');
      localStorage.removeItem('freeScanClaimToken');
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
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="John Doe" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Organisation Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Acme Corp" 
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="you@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Min. 8 characters" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary">
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Home } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const queryParams = new URLSearchParams(window.location.search);
    const source = queryParams.get('source');
    const scanUrl = queryParams.get('url');
    const scanScore = queryParams.get('score');

    if (source === 'free-scan' && scanUrl) {
      localStorage.setItem('freeScanUrl', scanUrl);
      localStorage.setItem('freeScanScore', scanScore || '75');
    }

    if (isLoggedIn === 'true') {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch('https://api.datawai.co.uk/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          organizationName: orgName
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      localStorage.setItem('isLoggedIn', 'true');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 10 }}>
        <a href="https://www.datawai.co.uk" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit' }}>
          <Home size={18} /> Back to Home
        </a>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your PDPA compliance journey</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleRegister}>
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
            <label className="form-label">Organization Name</label>
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
              required 
            />
          </div>

          <button type="submit" className="btn-primary">
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

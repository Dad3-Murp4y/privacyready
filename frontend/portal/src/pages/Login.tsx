import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Home } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder login logic
    if (email) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-glow" />
      <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 10 }}>
        <a href="http://localhost:3001" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit' }}>
          <Home size={18} /> Back to Home
        </a>
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={48} color="var(--sky)" strokeWidth={1.5} />
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Log in to manage your PDPA compliance</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
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
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Password</span>
              <a href="#" style={{ fontSize: '12px', textTransform: 'none' }}>Forgot password?</a>
            </label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn-primary">
            Sign In <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Create account</a>
        </div>
      </div>
    </div>
  );
}

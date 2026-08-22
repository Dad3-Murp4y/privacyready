import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const uid = searchParams.get('uid') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const linkIsValid = token.length > 0 && uid.length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!linkIsValid) {
      setError('This password reset link is missing required information.');
      return;
    }
    if (password.localeCompare(confirmation) !== 0) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The password could not be reset. Request a new link and try again.');
      setComplete(true);
      setPassword('');
      setConfirmation('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The password could not be reset. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container">
      <div className="auth-glow" />
      <section className="auth-card" aria-labelledby="reset-password-title">
        <div className="auth-header">
          <KeyRound size={48} aria-hidden="true" />
          <h1 className="auth-title" id="reset-password-title">{complete ? 'Password reset' : 'Choose a new password'}</h1>
          <p className="auth-subtitle">{complete ? 'Your password has been changed. You can now sign in.' : 'Use the one-time link from your reset email to choose a new password.'}</p>
        </div>

        {complete ? (
          <Link className="btn btn-primary" to="/login">Go to sign in</Link>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {error && <div role="alert" className="error-message">{error}</div>}
            {!linkIsValid && <div role="alert" className="error-message">This password reset link is missing required information. Request a new link from the sign-in page.</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="reset-new-password">New password</label>
              <input id="reset-new-password" className="form-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required disabled={!linkIsValid || loading} />
              <p className="muted">Use at least eight characters, including upper and lower case letters, a number and a symbol.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-confirm-password">Confirm new password</label>
              <input id="reset-confirm-password" className="form-input" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required disabled={!linkIsValid || loading} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!linkIsValid || loading} aria-busy={loading}>{loading ? 'Resetting password' : 'Reset password'}</button>
            <div className="auth-footer"><Link to="/login">Back to sign in</Link></div>
          </form>
        )}
      </section>
    </main>
  );
}

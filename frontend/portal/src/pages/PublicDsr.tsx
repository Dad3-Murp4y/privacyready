import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function PublicDsr() {
  const [searchParams] = useSearchParams();
  const orgName = searchParams.get('org');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subjectEmail: '',
    subjectName: '',
    requestType: 'ACCESS',
    reasonText: ''
  });

  // Verify backend health / offline state logic can be added here if needed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName) {
      setError('Organisation name is missing from the request URL.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const API = import.meta.env.VITE_API_URL || 'https://api.privacyready.co.uk';
      const res = await fetch(`${API}/api/public/dsr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationName: orgName,
          ...formData
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your request.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#fff', padding: '24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', maxWidth: '500px', width: '100%', textAlign: 'center', border: '1px solid rgba(165,215,232,0.2)' }}>
          <CheckCircle2 size={64} color="var(--primary)" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '24px', margin: '0 0 16px', color: 'var(--sky)' }}>Request Submitted</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
            Your Data Subject Request has been securely transmitted to <strong>{orgName}</strong>. 
            Under the UK GDPR, they have 30 days to review and respond to this request.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Shield size={14} /> Powered securely by PrivacyReady
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#fff', padding: '24px' }}>
      <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', maxWidth: '600px', width: '100%', border: '1px solid rgba(165,215,232,0.2)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Shield size={48} color="var(--sky)" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '24px', margin: '0 0 8px', color: 'var(--sky)' }}>Data Subject Request</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
            Submit a formal request to <strong>{orgName || 'this organisation'}</strong> regarding your personal data in accordance with the UK GDPR.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '14px', lineHeight: 1.5 }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              name="subjectName"
              className="form-input" 
              placeholder="e.g. Jane Doe"
              value={formData.subjectName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              name="subjectEmail"
              className="form-input" 
              placeholder="jane@example.com"
              value={formData.subjectEmail}
              onChange={handleChange}
              required
            />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              We will use this to contact you regarding your request.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Request Type</label>
            <select 
              name="requestType"
              className="form-input" 
              value={formData.requestType}
              onChange={handleChange}
              required
            >
              <option value="ACCESS">Right of Access (Get a copy of my data)</option>
              <option value="ERASURE">Right to Erasure (Delete my data)</option>
              <option value="RECTIFICATION">Right to Rectification (Correct my data)</option>
              <option value="PORTABILITY">Right to Data Portability (Transfer my data)</option>
              <option value="RESTRICTION">Right to Restrict Processing</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Additional Details (Optional)</label>
            <textarea 
              name="reasonText"
              className="form-input" 
              placeholder="Please provide any additional context to help locate your data..."
              rows={4}
              value={formData.reasonText}
              onChange={handleChange}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
            disabled={loading || !orgName}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Shield size={14} /> Powered securely by <a href="https://privacyready.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sky)', textDecoration: 'none' }}>PrivacyReady</a>
          </div>
        </div>
      </div>
    </div>
  );
}

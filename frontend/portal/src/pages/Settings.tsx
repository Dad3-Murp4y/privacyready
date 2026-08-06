import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, CreditCard, User, Mail, Building, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    orgName: string;
    subscriptionStatus: string;
    isPremium: boolean;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Fetch org/subscription status
        const subRes = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/subscription-status`, {
          credentials: 'include'
        });
        // Fetch user profile
        let email = '', name = '';
        try {
          const profileRes = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, { credentials: 'include' });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            email = profileData.email || '';
            name = profileData.fullName || 'User';
          }
        } catch(e) {}
        
        let subData: { subscriptionStatus: string; isPremium: boolean; orgName?: string } = { subscriptionStatus: 'free', isPremium: false };
        if (subRes.ok) {
          subData = await subRes.json();
        }
        
        setProfile({
          name,
          email,
          orgName: subData.orgName || 'My Organisation',
          subscriptionStatus: subData.subscriptionStatus,
          isPremium: subData.isPremium
        });
      } catch (err) {
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-portal-session`, {
      credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ returnUrl: window.location.href })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
      
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SettingsIcon size={24} color="var(--sky)" /> Account Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your profile and billing preferences.</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '24px' }}>
        
        {/* Profile Card */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Profile Details</h2>
          </div>
          <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={20} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Name</div>
                <div style={{ color: 'white', fontWeight: 500 }}>{profile?.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail size={20} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Email</div>
                <div style={{ color: 'white', fontWeight: 500 }}>{profile?.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building size={20} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Organisation Name</div>
                <div style={{ color: 'white', fontWeight: 500 }}>{profile?.orgName}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
              <button 
                onClick={() => { fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }); navigate('/login'); }}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}
              >
                <Key size={16} /> Reset Password
              </button>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                You will be logged out and can request a password reset link on the login page.
              </div>
            </div>
          </div>
        </div>

        {/* Billing Card */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} color="var(--sky)" /> Subscription & Billing
            </h2>
            {profile?.subscriptionStatus === 'active' && (
              <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500 }}>
                Active Plan
              </span>
            )}
          </div>
          <div style={{ padding: '20px' }}>
            {profile?.subscriptionStatus === 'active' ? (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                  You are currently subscribed to a paid plan. You can manage your payment methods, view your billing history, download invoices, or cancel your subscription through the secure Stripe billing portal.
                </p>
                <button 
                  className="btn btn-primary" 
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  style={{ opacity: portalLoading ? 0.7 : 1 }}
                >
                  {portalLoading ? 'Opening Portal...' : 'Manage Billing & Invoices'}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                  You are currently on the <strong>Free</strong> plan. Upgrade to a paid plan from your dashboard to access premium compliance tools.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

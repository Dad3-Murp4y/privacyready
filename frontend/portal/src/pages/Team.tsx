import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Teammate {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

const API = import.meta.env.VITE_API_URL;

export default function Team() {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('MEMBER');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const fetchTeam = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`${API}/api/team`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (res.status === 403) {
        setError("Only organization admins can manage the team.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load team');
      setTeammates(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTeammate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API}/api/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, fullName: newName, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add teammate');
        return;
      }
      setTeammates(prev => [{ id: data.id, email: data.email, fullName: data.fullName, role: data.role, createdAt: new Date().toISOString() }, ...prev]);
      setTempPassword(data.temporaryPassword);
      setNewEmail('');
      setNewName('');
      setNewRole('MEMBER');
    } catch {
      setError('Failed to add teammate');
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!window.confirm(`Remove ${email} from your organization?`)) return;
    setError('');
    try {
      const res = await fetch(`${API}/api/team/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to remove teammate');
        return;
      }
      setTeammates(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to remove teammate');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setTempPassword(null);
    setError('');
  };

  const copyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--sky)' }}>Loading team...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Users size={32} color="var(--sky)" />
            <h1 className="dashboard-title" style={{ margin: 0 }}>Team</h1>
          </div>
          <p className="dashboard-subtitle">Manage who has access to your organization's PrivacyReady account</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} /> Add Teammate
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(192, 57, 43, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      <div className="scan-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Joined</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}></th>
              </tr>
            </thead>
            <tbody>
              {teammates.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-light)' }}>{t.fullName}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{t.email}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      background: t.role === 'ADMIN' ? 'rgba(108, 143, 216, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: t.role === 'ADMIN' ? 'var(--sky)' : 'var(--text-muted)'
                    }}>
                      {t.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '16px' }}>
                    <button
                      onClick={() => handleRemove(t.id, t.email)}
                      title="Remove from organization"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {teammates.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No teammates yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="scan-card" style={{ maxWidth: '440px', width: '90%' }}>
            {!tempPassword ? (
              <>
                <h3 className="scan-card-title" style={{ marginBottom: '20px' }}>Add Teammate</h3>
                <form onSubmit={handleAddTeammate}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>Full Name</label>
                    <input
                      type="text" required value={newName} onChange={e => setNewName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--mid)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>Email</label>
                    <input
                      type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--mid)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>Role</label>
                    <select
                      value={newRole} onChange={e => setNewRole(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--mid)', color: 'var(--text-primary)' }}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  {error && <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Add</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 className="scan-card-title" style={{ marginBottom: '12px' }}>Invite sent</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                  We've emailed them a verification link and this temporary password. You can also share it directly as a backup -- it won't be shown again.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--mid)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                  <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--sky)' }}>{tempPassword}</code>
                  <button onClick={copyPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={closeModal}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

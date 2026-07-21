import { useState, useEffect } from 'react';
import { Shield, Users, Building2, Activity, Award, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalUsers: number;
  totalOrgs: number;
  totalScans: number;
  avgScore: number;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationName: string;
  createdAt: string;
}

interface Org {
  id: string;
  name: string;
  industry: string | null;
  userCount: number;
  scanCount: number;
  dsrCount: number;
  createdAt: string;
}

const ROLES = ['MEMBER', 'ADMIN', 'SUPERADMIN'];
const API = 'https://api.privacyready.co.uk';

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [tab, setTab] = useState<'users' | 'orgs'>('users');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  const fetchAdminData = async () => {
    try {
      if (!token) throw new Error('No token found');

      const [statsRes, usersRes, orgsRes] = await Promise.all([
        fetch(`${API}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/organizations`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (statsRes.status === 403 || usersRes.status === 403 || orgsRes.status === 403) {
        navigate('/dashboard');
        return;
      }

      if (!statsRes.ok || !usersRes.ok || !orgsRes.ok) throw new Error('Failed to fetch admin data');

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      setOrgs(await orgsRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to update role');
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setActionError('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Delete ${email}? This can't be undone.`)) return;
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete user');
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {
      setActionError('Failed to delete user');
    }
  };

  const handleDeleteOrg = async (orgId: string, name: string) => {
    if (!window.confirm(`Delete organization "${name}" and everything in it (users, scans, DSRs)? This can't be undone.`)) return;
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete organization');
        return;
      }
      setOrgs(prev => prev.filter(o => o.id !== orgId));
      setUsers(prev => prev.filter(u => u.organizationName !== name));
    } catch {
      setActionError('Failed to delete organization');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--sky)' }}>Loading platform data...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Shield size={32} color="var(--sky)" />
          <h1 className="dashboard-title" style={{ margin: 0 }}>Super Admin Dashboard</h1>
        </div>
        <p className="dashboard-subtitle">Platform-wide overview, user, and organization management</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(192, 57, 43, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}
      {actionError && (
        <div style={{ background: 'rgba(192, 57, 43, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>
          {actionError}
        </div>
      )}

      {stats && (
        <div className="stats-grid" style={{ marginBottom: '40px' }}>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(108, 143, 216, 0.1)' }}>
              <Users size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(108, 143, 216, 0.1)' }}>
              <Building2 size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalOrgs}</div>
            <div className="stat-label">Total Organizations</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(108, 143, 216, 0.1)' }}>
              <Activity size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalScans}</div>
            <div className="stat-label">Total Scans Executed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(108, 143, 216, 0.1)' }}>
              <Award size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.avgScore}/100</div>
            <div className="stat-label">Average Compliance Score</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setTab('users')}
          className={tab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px' }}
        >
          Users
        </button>
        <button
          onClick={() => setTab('orgs')}
          className={tab === 'orgs' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px' }}
        >
          Organizations
        </button>
      </div>

      {tab === 'users' && (
        <div className="scan-card">
          <h3 className="scan-card-title" style={{ marginBottom: '24px' }}>Registered Users</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Organization</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Joined</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-light)' }}>{user.fullName}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{user.email}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{user.organizationName}</td>
                    <td style={{ padding: '16px' }}>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        style={{
                          background: 'var(--mid)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '12px'
                        }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '16px' }}>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        title="Delete user"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orgs' && (
        <div className="scan-card">
          <h3 className="scan-card-title" style={{ marginBottom: '24px' }}>Organizations</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Users</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Scans</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>DSRs</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Created</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-light)' }}>{org.name}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.userCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.scanCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.dsrCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(org.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '16px' }}>
                      <button
                        onClick={() => handleDeleteOrg(org.id, org.name)}
                        title="Delete organization"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No organizations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

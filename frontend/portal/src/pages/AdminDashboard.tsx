import { useState, useEffect } from 'react';
import { Shield, Users, Building2, Activity, Award, Trash2, LogOut, ChevronDown, ChevronUp, AlertCircle, FileCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
const API = import.meta.env.VITE_API_URL;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [tab, setTab] = useState<'users' | 'orgs'>('users');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();


  const fetchAdminData = async () => {
    try {


      const [statsRes, usersRes, orgsRes] = await Promise.all([
        fetch(`${API}/api/admin/stats`, {
      credentials: 'include' }),
        fetch(`${API}/api/admin/users`, {
      credentials: 'include' }),
        fetch(`${API}/api/admin/organizations`, {
      credentials: 'include' })
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
      credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      credentials: 'include',
        method: 'DELETE',

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
    if (!window.confirm(`Delete organisation "${name}" and everything in it (users, scans, DSRs)? This can't be undone.`)) return;
    setActionError('');
    try {
      const res = await fetch(`${API}/api/admin/organizations/${orgId}`, {
      credentials: 'include',
        method: 'DELETE',

      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete organisation');
        return;
      }
      setOrgs(prev => prev.filter(o => o.id !== orgId));
      setUsers(prev => prev.filter(u => u.organizationName !== name));
    } catch {
      setActionError('Failed to delete organisation');
    }
  };

  const handleViewOrg = async (orgId: string) => {
    try {
      setLoading(true);
      const API = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API}/api/admin/organizations/${orgId}/details`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrgDetails(data);
        setSelectedOrg(orgId);
      } else {
        setActionError('Failed to fetch org details');
      }
    } catch (e) {
      setActionError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedOrg) {
    return (
      <div className="dashboard-container" style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ height: '60px', width: '30%', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
            <div style={{ height: '120px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '120px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '120px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: '120px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ height: '40px', width: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '300px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'var(--glass-bg)', padding: '16px 28px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, var(--sky), #3b82f6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield color="#0B2447" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#fff' }}>Super Admin Dashboard</h1>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Platform-wide overview, user, and organisation management</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Go to User Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--sky), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0B2447' }}>
              {authUser?.fullName.charAt(0) || 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{authUser?.fullName || 'Super Admin'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>System Administrator</span>
            </div>
            <button 
              onClick={() => { logout(); navigate('/login'); }} 
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', marginLeft: '8px', transition: 'color 0.2s' }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

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
            <div className="stat-label">Total Organisations</div>
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
          onClick={() => { setTab('users'); setSelectedOrg(null); }}
          className={tab === 'users' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px' }}
        >
          Users
        </button>
        <button
          onClick={() => { setTab('orgs'); setSelectedOrg(null); }}
          className={tab === 'orgs' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 20px' }}
        >
          Organisations
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
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Organisation</th>
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

      {tab === 'orgs' && !selectedOrg && (
        <div className="scan-card">
          <h3 className="scan-card-title" style={{ marginBottom: '24px' }}>Organisations</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Users</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Scans</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>DSRs</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Created</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-light)', fontWeight: 600 }}>{org.name}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.userCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.scanCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{org.dsrCount}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(org.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleViewOrg(org.id)}
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(org.id, org.name)}
                          title="Delete organisation"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No organisations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orgs' && selectedOrg && orgDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="scan-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <button onClick={() => { setSelectedOrg(null); setExpandedScan(null); }} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  &larr; Back to Organisations
                </button>
                <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Building2 color="var(--sky)" size={28} />
                  {orgDetails.name}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Client since {new Date(orgDetails.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--sky)' }}>{orgDetails.users.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Users</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--sky)' }}>{orgDetails.scans.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Scans</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: orgDetails.scans.length > 0 && orgDetails.scans[0]?.score >= 80 ? '#27ae60' : 'var(--warning)' }}>
                    {orgDetails.scans.length > 0 && orgDetails.scans[0]?.score ? `${orgDetails.scans[0].score}/100` : 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Latest Score</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--sky)" /> Registered Users
                </h3>
                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-muted)' }}>Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-muted)' }}>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgDetails.users.map((u: any) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-light)' }}>
                            <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, background: u.role === 'SUPERADMIN' ? 'rgba(231,76,60,0.15)' : u.role === 'ADMIN' ? 'rgba(52,152,219,0.15)' : 'rgba(255,255,255,0.05)', color: u.role === 'SUPERADMIN' ? '#e74c3c' : u.role === 'ADMIN' ? '#3498db' : 'var(--text-secondary)' }}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="var(--sky)" /> Scan History & Findings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {orgDetails.scans.map((s: any) => (
                    <div key={s.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedScan(expandedScan === s.id ? null : s.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', background: expandedScan === s.id ? 'rgba(255,255,255,0.02)' : 'transparent', transition: 'background 0.2s' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.score >= 80 ? 'rgba(39, 174, 96, 0.15)' : s.score >= 50 ? 'rgba(241, 196, 15, 0.15)' : 'rgba(231, 76, 60, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileCheck size={20} color={s.score >= 80 ? '#27ae60' : s.score >= 50 ? '#f1c40f' : '#e74c3c'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{s.targetIdentifier}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.scanType} • {new Date(s.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: s.score >= 80 ? '#27ae60' : s.score >= 50 ? '#f1c40f' : '#e74c3c' }}>{s.score !== null ? `${s.score}/100` : 'Pending'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</div>
                          </div>
                          {expandedScan === s.id ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                        </div>
                      </div>
                      
                      {expandedScan === s.id && s.findingsJson && (
                        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Detailed Findings</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(Array.isArray(s.findingsJson) ? s.findingsJson : []).map((check: any, idx: number) => {
                              const passed = check.status === 'PASS' || check.passed === true;
                              const name = check.finding_type || check.checkName || check.title || check.name || 'GDPR Finding';
                              const details = check.description || check.detail || check.details || (passed ? 'No issues detected.' : 'Remediation required.');
                              return (
                                <div key={idx} style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                  <div style={{ paddingTop: '2px' }}>
                                    {passed ? <CheckCircle2 size={16} color="#27ae60" /> : <AlertCircle size={16} color="var(--warning)" />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: passed ? '#fff' : 'var(--warning)', marginBottom: '4px' }}>{name}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{details}</div>
                                  </div>
                                </div>
                              );
                            })}
                            {(!Array.isArray(s.findingsJson) || s.findingsJson.length === 0) && (
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No detailed checks available in the findings payload.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {orgDetails.scans.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                      No scans found for this organisation.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

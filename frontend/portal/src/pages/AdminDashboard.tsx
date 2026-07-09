import { useState, useEffect } from 'react';
import { Shield, Users, Building2, Activity, Award } from 'lucide-react';
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const [statsRes, usersRes] = await Promise.all([
          fetch('https://api.privacyready.co.uk/api/admin/stats', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }),
          fetch('https://api.privacyready.co.uk/api/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (statsRes.status === 403 || usersRes.status === 403) {
          navigate('/dashboard');
          return;
        }

        if (!statsRes.ok || !usersRes.ok) throw new Error('Failed to fetch admin data');

        const statsData = await statsRes.json();
        const usersData = await usersRes.json();

        setStats(statsData);
        setUsers(usersData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [navigate]);

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
        <p className="dashboard-subtitle">Platform-wide overview and user management</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {stats && (
        <div className="stats-grid" style={{ marginBottom: '40px' }}>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
              <Users size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
              <Building2 size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalOrgs}</div>
            <div className="stat-label">Total Organizations</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
              <Activity size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.totalScans}</div>
            <div className="stat-label">Total Scans Executed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
              <Award size={24} color="var(--sky)" />
            </div>
            <div className="stat-value">{stats.avgScore}/100</div>
            <div className="stat-label">Average Compliance Score</div>
          </div>
        </div>
      )}

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
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-light)' }}>{user.fullName}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{user.email}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{user.organizationName}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      background: user.role === 'SUPERADMIN' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: user.role === 'SUPERADMIN' ? 'var(--sky)' : 'var(--text-muted)'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

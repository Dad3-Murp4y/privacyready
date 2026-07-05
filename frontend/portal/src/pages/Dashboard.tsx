import { ShieldCheck, FileText, UserCheck, LogOut, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldCheck size={28} color="var(--sky)" />
          DataWai Portal
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <Activity size={20} /> Overview
          </a>
          <a href="#" className="nav-item">
            <FileText size={20} /> Past Audits
          </a>
          <a href="#" className="nav-item">
            <UserCheck size={20} /> DSR Manager
          </a>
        </nav>

        <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
          <LogOut size={20} /> Sign Out
        </a>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <h1 className="page-title">Compliance Overview</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Track your PDPA health across web and social properties.
          </p>
        </header>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Overall PDPA Score</div>
            <div className="metric-value good">92%</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              ↑ 12% from last month
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-label">Website Vulnerabilities</div>
            <div className="metric-value warn">3</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Pending fixes on cookies
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Pending DSR Requests</div>
            <div className="metric-value danger">2</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Requires attention
            </div>
          </div>
        </div>

        <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Recent Audit Reports</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: '600' }}>example.co.th (Website)</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Scanned today at 10:45 AM</div>
              </div>
              <div style={{ color: '#4ade80', fontWeight: 'bold' }}>Passed</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: '600' }}>Facebook Page: 1042392434</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Scanned yesterday</div>
              </div>
              <div style={{ color: '#facc15', fontWeight: 'bold' }}>Warning</div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

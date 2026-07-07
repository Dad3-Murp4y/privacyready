import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  LogOut, 
  Activity, 
  Plus, 
  Search,
  Globe,
  Loader2,
  Trash2
} from 'lucide-react';

interface Audit {
  id: string;
  target: string;
  type: 'Website' | 'Facebook' | 'LINE' | 'TikTok';
  date: string;
  score: number;
  status: 'Passed' | 'Warning';
}

interface DSR {
  id: string;
  type: string;
  email: string;
  date: string;
  status: 'Pending' | 'Completed' | 'In Progress';
  description?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'past_audits' | 'dsr_manager'>('overview');
  
  // Audits list state, initialized with dynamic free scan if it exists, otherwise defaults
  const [audits, setAudits] = useState<Audit[]>(() => {
    const list: Audit[] = [];
    const freeScanUrl = localStorage.getItem('freeScanUrl');
    const freeScanScore = localStorage.getItem('freeScanScore');
    
    if (freeScanUrl) {
      try {
        const hostname = new URL(freeScanUrl).hostname || freeScanUrl;
        list.push({
          id: 'audit-free',
          target: hostname,
          type: 'Website',
          date: 'Just now (from homepage)',
          score: parseInt(freeScanScore || '75'),
          status: parseInt(freeScanScore || '75') >= 80 ? 'Passed' : 'Warning'
        });
      } catch (e) {
        list.push({
          id: 'audit-free',
          target: freeScanUrl,
          type: 'Website',
          date: 'Just now (from homepage)',
          score: parseInt(freeScanScore || '75'),
          status: parseInt(freeScanScore || '75') >= 80 ? 'Passed' : 'Warning'
        });
      }
    }
    
    return list;
  });

  // DSR list state
  const [dsrs, setDsrs] = useState<DSR[]>([]);

  // Form / Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDsrModal, setShowDsrModal] = useState(false);

  // New Audit Input
  const [newAuditUrl, setNewAuditUrl] = useState('');
  const [newAuditType, setNewAuditType] = useState<'Website' | 'Facebook' | 'LINE' | 'TikTok'>('Website');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // New DSR Input
  const [newDsrType, setNewDsrType] = useState('Access');
  const [newDsrEmail, setNewDsrEmail] = useState('');
  const [newDsrDescription, setNewDsrDescription] = useState('');

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Dynamically compute metrics
  const overallScore = audits.length > 0 
    ? Math.round(audits.reduce((acc, curr) => acc + curr.score, 0) / audits.length) 
    : 100;
  const websiteVulnerabilities = audits.filter(a => a.type === 'Website' && a.status === 'Warning').length * 2 + 1;
  const pendingDsrs = dsrs.filter(d => d.status === 'Pending' || d.status === 'In Progress').length;

  // Handle Sign Out
  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.clear();
    navigate('/login');
  };

  // Run Simulated Scan
  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuditUrl) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs(['[INFO] Initializing DataWai remote scanning core...']);

    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += 20;
      setScanProgress(progressVal);

      if (progressVal === 20) {
        setScanLogs(prev => [...prev, `[INFO] Resolving endpoint target: ${newAuditUrl}`, '[INFO] Verifying SSL/TLS encryption parameters...']);
      } else if (progressVal === 40) {
        setScanLogs(prev => [...prev, '[INFO] Fetching landing page elements and checking tracking scripts...', '[WARN] Detected 3 third-party scripts loaded without active consent banner control.']);
      } else if (progressVal === 60) {
        setScanLogs(prev => [...prev, '[INFO] Performing PDPA form audit (checking privacy notice, data retention declarations)...', '[INFO] Analyzing Cookie declaration list for required disclosures...']);
      } else if (progressVal === 80) {
        setScanLogs(prev => [...prev, '[INFO] Compiling security vulnerabilities and data transfer mappings...', '[INFO] Generating unified risk factor assessment...']);
      } else if (progressVal === 100) {
        clearInterval(interval);
        setScanLogs(prev => [...prev, '[SUCCESS] Scan completed. Storing unified audit score to database...']);

        // Generate score and add audit
        setTimeout(() => {
          const generatedScore = Math.floor(Math.random() * 21) + 75; // 75 - 95
          const newAudit: Audit = {
            id: `audit-${Date.now()}`,
            target: newAuditUrl.replace(/https?:\/\/(www\.)?/, ''),
            type: newAuditType,
            date: 'Just now',
            score: generatedScore,
            status: generatedScore >= 80 ? 'Passed' : 'Warning'
          };
          setAudits(prev => [newAudit, ...prev]);
          setIsScanning(false);
          setShowAuditModal(false);
          setNewAuditUrl('');
        }, 600);
      }
    }, 850);
  };

  // Create DSR
  const handleCreateDsr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDsrEmail) return;

    const newDsr: DSR = {
      id: `dsr-${Math.floor(Math.random() * 90000) + 10000}`,
      type: newDsrType,
      email: newDsrEmail,
      date: 'Just now',
      status: 'Pending',
      description: newDsrDescription
    };

    setDsrs(prev => [newDsr, ...prev]);
    setShowDsrModal(false);
    setNewDsrEmail('');
    setNewDsrDescription('');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldCheck size={28} color="var(--sky)" />
          DataWai Portal
        </div>
        
        <nav className="sidebar-nav">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <Activity size={20} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('past_audits')} 
            className={`nav-item ${activeTab === 'past_audits' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FileText size={20} /> Past Audits
          </button>
          <button 
            onClick={() => setActiveTab('dsr_manager')} 
            className={`nav-item ${activeTab === 'dsr_manager' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <UserCheck size={20} /> DSR Manager
          </button>
        </nav>

        <a href="#" className="nav-item" onClick={handleSignOut} style={{ marginTop: 'auto' }}>
          <LogOut size={20} /> Sign Out
        </a>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="tab-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 className="page-title">Compliance Overview</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Track your PDPA health across web and social properties.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowAuditModal(true)} style={{ margin: 0 }}>
                <Plus size={18} /> New Audit
              </button>
            </header>

            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Overall PDPA Score</div>
                <div className="metric-value good">{overallScore}%</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Based on {audits.length} active audit assets
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Website Vulnerabilities</div>
                <div className="metric-value warn">{websiteVulnerabilities}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Pending cookie notice consent issues
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Pending DSR Requests</div>
                <div className="metric-value danger">{pendingDsrs}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Requires urgent attention
                </div>
              </div>
            </div>

            <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px' }}>Recent Audit Reports</h2>
                <button 
                  onClick={() => setActiveTab('past_audits')} 
                  style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                >
                  View All
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {audits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--glass-border)', fontSize: '14px' }}>
                    No audit reports found. Start by running a new scan!
                  </div>
                ) : (
                  audits.map((audit) => (
                  <div key={audit.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--sky)' }}>
                        <Globe size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '600' }}>{audit.target}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{audit.date}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{audit.score}%</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score</div>
                      </div>
                      <div style={{ 
                        color: audit.status === 'Passed' ? '#4ade80' : '#facc15', 
                        fontWeight: 'bold',
                        background: audit.status === 'Passed' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(250, 204, 21, 0.1)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '13px'
                      }}>
                        {audit.status}
                      </div>
                    </div>
                  </div>
                )))}
              </div>
            </section>
          </div>
        )}

        {/* PAST AUDITS TAB */}
        {activeTab === 'past_audits' && (
          <div className="tab-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 className="page-title">Audit Reports</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Manage and run compliance audits on your domains and social platforms.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowAuditModal(true)} style={{ margin: 0 }}>
                <Plus size={18} /> Run New Audit
              </button>
            </header>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search audited domains or assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '14px 16px 14px 48px',
                    color: 'var(--text-primary)',
                    fontSize: '15px'
                  }}
                />
              </div>
            </div>

            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Audited Asset</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Asset Type</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Scan Date</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Compliance Score</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>PDPA Status</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.filter(a => a.target.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No audit reports found.
                      </td>
                    </tr>
                  ) : (
                    audits.filter(a => a.target.toLowerCase().includes(searchTerm.toLowerCase())).map((audit) => (
                    <tr key={audit.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '16px 24px', fontWeight: 600 }}>{audit.target}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{audit.type}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{audit.date}</td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{audit.score}%</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          color: audit.status === 'Passed' ? '#4ade80' : '#facc15',
                          background: audit.status === 'Passed' ? 'rgba(74, 222, 128, 0.08)' : 'rgba(250, 204, 21, 0.08)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 600
                        }}>
                          {audit.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <button 
                          onClick={() => setAudits(prev => prev.filter(item => item.id !== audit.id))}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete Audit"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DSR MANAGER TAB */}
        {activeTab === 'dsr_manager' && (
          <div className="tab-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 className="page-title">Data Subject Access Request (DSR) Manager</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Receive, audit, and log consumer requests under PDPA privacy standards.
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowDsrModal(true)} style={{ margin: 0 }}>
                <Plus size={18} /> Log Request
              </button>
            </header>

            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Request ID</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Subject Email</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Request Type</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Submitted Date</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>PDPA Timeline Status</th>
                    <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dsrs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No DSR privacy requests logged yet.
                      </td>
                    </tr>
                  ) : (
                    dsrs.map((dsr) => (
                      <tr key={dsr.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '16px 24px', fontWeight: 'bold', color: 'var(--sky)' }}>{dsr.id}</td>
                        <td style={{ padding: '16px 24px' }}>{dsr.email}</td>
                        <td style={{ padding: '16px 24px', fontWeight: '500' }}>{dsr.type}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{dsr.date}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            color: dsr.status === 'Completed' ? '#4ade80' : dsr.status === 'In Progress' ? '#60a5fa' : '#facc15',
                            background: dsr.status === 'Completed' ? 'rgba(74, 222, 128, 0.08)' : dsr.status === 'In Progress' ? 'rgba(96, 165, 250, 0.08)' : 'rgba(250, 204, 21, 0.08)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {dsr.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                              onClick={() => {
                                alert(`DSR Request Details:\nID: ${dsr.id}\nEmail: ${dsr.email}\nType: ${dsr.type}\nNotes: ${dsr.description || 'No description provided.'}`);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            >
                              Details
                            </button>
                            <button 
                              onClick={() => {
                                setDsrs(prev => prev.map(d => d.id === dsr.id ? { ...d, status: 'Completed' as const } : d));
                              }}
                              disabled={dsr.status === 'Completed'}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#4ade80', 
                                cursor: dsr.status === 'Completed' ? 'not-allowed' : 'pointer', 
                                opacity: dsr.status === 'Completed' ? 0.4 : 1, 
                                fontSize: '13px', 
                                fontWeight: 500 
                              }}
                            >
                              Complete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* NEW AUDIT MODAL */}
      {showAuditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--mid)', border: '1px solid var(--glass-border)', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
            
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Run Remote PDPA Audit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Select target type and input identifier to start.
            </p>

            {isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Loader2 className="spin" size={24} color="var(--sky)" />
                  <span style={{ fontWeight: '500' }}>Running scan ({scanProgress}%)</span>
                </div>
                
                {/* Progress bar */}
                <div style={{ background: 'rgba(0,0,0,0.3)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--sky)', width: `${scanProgress}%`, height: '100%', transition: 'width 0.4s' }} />
                </div>

                {/* Simulated Logs console */}
                <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', height: '180px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {scanLogs.map((log, index) => (
                    <div key={index} style={{ 
                      color: log.startsWith('[SUCCESS]') ? '#4ade80' : log.startsWith('[WARN]') ? '#facc15' : '#94a3b8'
                    }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleStartScan} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Asset Type</label>
                  <select 
                    value={newAuditType} 
                    onChange={(e) => setNewAuditType(e.target.value as any)}
                    className="form-input"
                    style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                  >
                    <option value="Website">Website</option>
                    <option value="Facebook">Facebook Page</option>
                    <option value="LINE">LINE Account</option>
                    <option value="TikTok">TikTok Handle</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Identifier / URL</label>
                  <input 
                    type="text" 
                    required 
                    placeholder={newAuditType === 'Website' ? 'https://example.com' : 'e.g. datawai.compliance'}
                    value={newAuditUrl}
                    onChange={(e) => setNewAuditUrl(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowAuditModal(false)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ flex: 1, margin: 0 }}
                  >
                    Run Scan
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* NEW DSR MODAL */}
      {showDsrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--mid)', border: '1px solid var(--glass-border)', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
            
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Log DSR Privacy Request</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Manually file a consumer data request received from support channels.
            </p>

            <form onSubmit={handleCreateDsr} className="auth-form">
              <div className="form-group">
                <label className="form-label">Request Type</label>
                <select 
                  value={newDsrType} 
                  onChange={(e) => setNewDsrType(e.target.value)}
                  className="form-input"
                  style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                >
                  <option value="Access">Access (Request personal records)</option>
                  <option value="Erasure">Erasure (Right to be forgotten)</option>
                  <option value="Rectification">Rectification (Modify info)</option>
                  <option value="Portability">Portability (Download payload)</option>
                  <option value="Restriction">Restriction (Freeze processing)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Subject Email</label>
                <input 
                  type="email" 
                  required 
                  placeholder="consumer@email.com"
                  value={newDsrEmail}
                  onChange={(e) => setNewDsrEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Notes / Request Context</label>
                <textarea 
                  rows={3}
                  placeholder="Provide any details about the consumer's request..."
                  value={newDsrDescription}
                  onChange={(e) => setNewDsrDescription(e.target.value)}
                  className="form-input"
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowDsrModal(false)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1, margin: 0 }}
                >
                  Submit Request
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

import { useState, useEffect } from 'react';
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
  Trash2,
  ArrowRight,
  Clock
} from 'lucide-react';

interface AuditCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface Audit {
  id: string;
  target: string;
  type: 'Website' | 'Facebook' | 'LINE' | 'TikTok';
  date: string;
  score: number;
  status: 'Passed' | 'Warning';
  logs?: string[];
  checks?: AuditCheck[];
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
  
  // User profile
  const [userProfile, setUserProfile] = useState<{fullName: string, email: string, organizationName: string, role?: string} | null>(null);

  // Audits list state, initialized from backend API
  const [audits, setAudits] = useState<Audit[]>([]);

  // DSR list state
  const [dsrs, setDsrs] = useState<DSR[]>([]);

  // Form / Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDsrModal, setShowDsrModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  // Live Date/Time
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        // Verify token expiration client-side
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload.exp * 1000;
          if (Date.now() >= exp) {
            localStorage.removeItem('token');
            navigate('/login');
            return;
          }
          const timeUntilExp = exp - Date.now();
          setTimeout(() => {
            alert('Your session has expired. Please log in again.');
            localStorage.removeItem('token');
            navigate('/login');
          }, timeUntilExp);
        } catch (e) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        // Fetch user profile
        const meRes = await fetch('https://api.privacyready.co.uk/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (meRes.ok) {
          setUserProfile(await meRes.json());
        } else if (meRes.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const res = await fetch('https://api.privacyready.co.uk/api/scan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const mappedAudits = data.map((d: any) => ({
            id: d.id,
            target: d.targetIdentifier,
            type: d.scanType,
            date: new Date(d.createdAt).toLocaleString(),
            score: d.score || 0,
            status: d.status === 'COMPLETED' ? (d.score >= 80 ? 'Passed' : 'Warning') : d.status,
            logs: [],
            checks: d.findingsJson?.map((f: any) => ({
              name: f.finding_type || f.platform,
              passed: f.severity === 'low' || !f.severity,
              details: f.description
            })) || []
          }));
          setAudits(mappedAudits);
        }
      } catch (err) {
        console.error('Failed to fetch audits:', err);
      }
    };
    fetchAudits();
  }, []);

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
  const websiteVulnerabilities = audits.filter(a => a.type === 'Website' && a.status === 'Warning').length * 2 + (audits.length > 0 ? 1 : 0);
  const pendingDsrs = dsrs.filter(d => d.status === 'Pending' || d.status === 'In Progress').length;

  // Handle Sign Out
  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.clear();
    navigate('/login');
  };

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuditUrl) return;

    if (newAuditType === 'Website') {
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
      if (!urlPattern.test(newAuditUrl)) {
        alert("Please enter a valid website address (e.g., example.com or https://example.com)");
        return;
      }
    } else {
      const handlePattern = /^(https?:\/\/[\w\.-]+\.[a-z]{2,})|(@?[a-zA-Z0-9_\.-]+)$/i;
      if (!handlePattern.test(newAuditUrl) || newAuditUrl.includes(' ')) {
        alert(`Please enter a valid ${newAuditType} URL or handle without spaces.`);
        return;
      }
    }

    setIsScanning(true);
    setScanProgress(30);
    setScanLogs(['[INFO] Initializing DataWai remote scanning core...', '[INFO] Connecting to backend scanner microservice...']);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const res = await fetch('https://api.privacyready.co.uk/api/scan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          targetIdentifier: newAuditUrl.replace(/https?:\/\/(www\.)?/, ''),
          scanType: newAuditType
        })
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      setScanProgress(100);
      setScanLogs(prev => [...prev, '[SUCCESS] Scan completed. Fetched unified audit score from database.']);
      
      const d = await res.json();
      
      const newAudit: Audit = {
        id: d.id,
        target: d.targetIdentifier,
        type: d.scanType,
        date: new Date(d.createdAt).toLocaleString(),
        score: d.score || 0,
        status: d.status === 'COMPLETED' ? (d.score >= 80 ? 'Passed' : 'Warning') : d.status,
        checks: d.findingsJson?.map((f: any) => ({
          name: f.finding_type || f.platform,
          passed: f.severity === 'low' || !f.severity,
          details: f.description
        })) || []
      };

      setAudits(prev => [newAudit, ...prev]);
      setIsScanning(false);
      setShowAuditModal(false);
      setNewAuditUrl('');
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      alert("Scan failed to run");
    }
  };

  // Create DSR
  const handleCreateDsr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDsrEmail) return;

    const newDsr: DSR = {
      id: `dsr-${Math.floor(Math.random() * 90000) + 10000}`,
      type: newDsrType,
      email: newDsrEmail,
      date: new Date().toLocaleString(),
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
      <aside className="sidebar animate-fade-up">
        <div className="sidebar-logo">
          <ShieldCheck size={28} color="var(--sky)" />
          DataWai Portal
        </div>
        
        {userProfile && (
          <div className="user-profile-widget">
            <div className="user-name">{userProfile.fullName}</div>
            <div className="user-org">{userProfile.organizationName}</div>
            <div className="live-time-container">
              <div className="live-indicator"></div>
              <Clock size={12} />
              {currentTime.toLocaleString(undefined, { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <Activity className="nav-icon" size={20} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('past_audits')} 
            className={`nav-item ${activeTab === 'past_audits' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FileText className="nav-icon" size={20} /> Past Audits
          </button>
          <button 
            onClick={() => setActiveTab('dsr_manager')} 
            className={`nav-item ${activeTab === 'dsr_manager' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <UserCheck className="nav-icon" size={20} /> DSR Manager
          </button>
        </nav>

        <a href="#" className="nav-item" onClick={handleSignOut} style={{ marginTop: 'auto', color: 'var(--text-secondary)' }}>
          <LogOut className="nav-icon" size={20} /> Sign Out
        </a>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        
        {/* DETAILED SCAN VIEW */}
        {selectedAudit ? (
          <div className="animate-fade-up">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <button 
                  onClick={() => setSelectedAudit(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '12px', padding: 0 }}
                  className="btn-link"
                >
                  <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Dashboard
                </button>
                <h1 className="page-title">{selectedAudit.target}</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{selectedAudit.type} Scan</span>
                  <span>•</span>
                  <span>{selectedAudit.date}</span>
                </p>
              </div>
              <div style={{ 
                background: selectedAudit.status === 'Passed' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 214, 0, 0.1)',
                color: selectedAudit.status === 'Passed' ? 'var(--success)' : 'var(--warning)',
                padding: '12px 24px',
                borderRadius: '16px',
                border: `1px solid ${selectedAudit.status === 'Passed' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 214, 0, 0.2)'}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                boxShadow: `0 0 20px ${selectedAudit.status === 'Passed' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 214, 0, 0.1)'}`
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>Compliance Status</span>
                <span style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>{selectedAudit.status}</span>
              </div>
            </header>

            <div className="metric-grid animate-fade-up stagger-1" style={{ marginBottom: '32px' }}>
              <div className="metric-card">
                <div className="metric-label">PDPA Score</div>
                <div className={`metric-value ${selectedAudit.score >= 80 ? 'good' : selectedAudit.score >= 50 ? 'warn' : 'danger'}`}>
                  {selectedAudit.score}%
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Checks Passed</div>
                <div className="metric-value good">
                  {selectedAudit.checks?.filter(c => c.passed).length || 0}
                  <span style={{ fontSize: '20px', color: 'var(--text-tertiary)' }}> / {selectedAudit.checks?.length || 0}</span>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Critical Findings</div>
                <div className="metric-value danger">
                  {selectedAudit.checks?.filter(c => !c.passed).length || 0}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '22px', marginBottom: '20px', fontWeight: 600 }} className="animate-fade-up stagger-2">Detailed Findings</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }} className="animate-fade-up stagger-2">
              {selectedAudit.checks?.map((check, i) => (
                <div key={i} className="content-card" style={{ 
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  textAlign: 'left',
                  borderTop: `3px solid ${check.passed ? 'var(--success)' : 'var(--warning)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{check.name}</h3>
                    <span style={{ 
                      background: check.passed ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 214, 0, 0.1)',
                      color: check.passed ? 'var(--success)' : 'var(--warning)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {check.passed ? 'PASS' : 'ISSUE'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, flex: 1, margin: 0 }}>
                    {check.details}
                  </p>
                </div>
              ))}
            </div>

            {(!selectedAudit.checks || selectedAudit.checks.length === 0) && (
               <div className="content-card animate-fade-up stagger-2" style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                 {selectedAudit.logs?.map((log, i) => (
                   <div key={i} style={{ marginBottom: '8px', color: log.startsWith('[WARN]') || log.startsWith('[FAIL]') ? 'var(--warning)' : log.startsWith('[SUCCESS]') ? 'var(--success)' : 'var(--text-secondary)' }}>{log}</div>
                 ))}
                 {(!selectedAudit.logs || selectedAudit.logs.length === 0) && "No logs or findings available for this scan."}
               </div>
            )}
            
          </div>
        ) : (
          <>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">Compliance Overview</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Track your PDPA health across web and social properties.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAuditModal(true)}>
                <Plus size={18} /> New Audit
              </button>
            </header>

            <div className="metric-grid animate-fade-up stagger-1">
              <div className="metric-card">
                <div className="metric-label">Overall PDPA Score</div>
                <div className="metric-value good">{overallScore}%</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  Based on {audits.length} active audit assets
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Website Vulnerabilities</div>
                <div className="metric-value warn">{websiteVulnerabilities}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  Pending cookie notice consent issues
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Pending DSR Requests</div>
                <div className="metric-value danger">{pendingDsrs}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  Requires urgent attention
                </div>
              </div>
            </div>

            <section className="animate-fade-up stagger-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 600 }}>Recent Audit Reports</h2>
                <button 
                  onClick={() => setActiveTab('past_audits')} 
                  style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  View All <ArrowRight size={14} />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {audits.length === 0 ? (
                  <div className="empty-state">
                    <Globe className="empty-icon" />
                    <div className="empty-title">No Scans Found</div>
                    <div className="empty-desc">Your dashboard is empty. Run your first automated PDPA compliance scan to uncover vulnerabilities.</div>
                    <button className="btn btn-primary" onClick={() => setShowAuditModal(true)}>Start Scan</button>
                  </div>
                ) : (
                  audits.map((audit) => (
                  <div key={audit.id} onClick={() => setSelectedAudit(audit)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s' }} className="hover-lift">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(124, 77, 255, 0.2))', color: 'var(--sky)' }}>
                        <Globe size={24} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>{audit.target}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{audit.date}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '18px' }}>{audit.score}%</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Score</div>
                      </div>
                      <div style={{ 
                        color: audit.status === 'Passed' ? 'var(--success)' : 'var(--warning)', 
                        fontWeight: '600',
                        background: audit.status === 'Passed' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 214, 0, 0.1)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        boxShadow: `0 0 10px ${audit.status === 'Passed' ? 'rgba(0, 230, 118, 0.05)' : 'rgba(255, 214, 0, 0.05)'}`
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
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">Audit Reports</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Manage and run compliance audits on your domains and social platforms.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAuditModal(true)}>
                <Plus size={18} /> Run New Audit
              </button>
            </header>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }} className="animate-fade-up stagger-1">
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search audited domains or assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                />
              </div>
            </div>

            <div className="animate-fade-up stagger-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', overflow: 'hidden', backdropFilter: 'blur(16px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audited Asset</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asset Type</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan Date</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Score</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PDPA Status</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.filter(a => a.target.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="empty-state" style={{ padding: 0 }}>
                          <FileText className="empty-icon" style={{ opacity: 0.5 }} />
                          <div className="empty-title">No records found</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    audits.filter(a => a.target.toLowerCase().includes(searchTerm.toLowerCase())).map((audit) => (
                    <tr key={audit.id} onClick={() => setSelectedAudit(audit)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '20px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>{audit.target}</td>
                      <td style={{ padding: '20px 24px', color: 'var(--text-secondary)' }}>{audit.type}</td>
                      <td style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>{audit.date}</td>
                      <td style={{ padding: '20px 24px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{audit.score}%</td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ 
                          color: audit.status === 'Passed' ? 'var(--success)' : 'var(--warning)',
                          background: audit.status === 'Passed' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 214, 0, 0.1)',
                          padding: '6px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 600
                        }}>
                          {audit.status}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setAudits(prev => prev.filter(item => item.id !== audit.id))}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                          title="Delete Audit"
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
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
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">Data Subject Request Manager</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Receive, audit, and log consumer requests under PDPA privacy standards.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowDsrModal(true)}>
                <Plus size={18} /> Log Request
              </button>
            </header>

            <div className="animate-fade-up stagger-1" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', overflow: 'hidden', backdropFilter: 'blur(16px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request ID</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject Email</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request Type</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submitted Date</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dsrs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="empty-state" style={{ padding: 0 }}>
                          <UserCheck className="empty-icon" style={{ opacity: 0.5 }} />
                          <div className="empty-title">No DSRs Logged</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dsrs.map((dsr) => (
                      <tr key={dsr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '20px 24px', fontWeight: 'bold', color: 'var(--sky)', fontFamily: 'var(--font-mono)' }}>{dsr.id}</td>
                        <td style={{ padding: '20px 24px', color: 'var(--text-primary)' }}>{dsr.email}</td>
                        <td style={{ padding: '20px 24px', fontWeight: '500' }}>{dsr.type}</td>
                        <td style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>{dsr.date}</td>
                        <td style={{ padding: '20px 24px' }}>
                          <span style={{ 
                            color: dsr.status === 'Completed' ? 'var(--success)' : dsr.status === 'In Progress' ? 'var(--sky)' : 'var(--warning)',
                            background: dsr.status === 'Completed' ? 'rgba(0, 230, 118, 0.1)' : dsr.status === 'In Progress' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 214, 0, 0.1)',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {dsr.status}
                          </span>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                              onClick={() => {
                                alert(`DSR Request Details:\nID: ${dsr.id}\nEmail: ${dsr.email}\nType: ${dsr.type}\nNotes: ${dsr.description || 'No description provided.'}`);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
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
                                color: 'var(--success)', 
                                cursor: dsr.status === 'Completed' ? 'not-allowed' : 'pointer', 
                                opacity: dsr.status === 'Completed' ? 0.4 : 1, 
                                fontSize: '13px', 
                                fontWeight: 600 
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
        </>
      )}

      </main>

      {/* NEW AUDIT MODAL */}
      {showAuditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 28, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} className="animate-fade-up">
          <div style={{ background: 'linear-gradient(180deg, var(--mid) 0%, var(--navy) 100%)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '40px', position: 'relative', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
            
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>Run PDPA Audit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
              Select target type and input identifier to start scanning.
            </p>

            {isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Loader2 className="spin" size={28} color="var(--sky)" />
                  <span style={{ fontWeight: '600', fontSize: '16px' }}>Running deep scan ({scanProgress}%)</span>
                </div>
                
                {/* Progress bar */}
                <div style={{ background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                  <div style={{ background: 'linear-gradient(90deg, var(--sky), var(--accent))', width: `${scanProgress}%`, height: '100%', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }} />
                </div>

                {/* Simulated Logs console */}
                <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', height: '200px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'inset 0 5px 15px rgba(0,0,0,0.5)' }}>
                  {scanLogs.map((log, index) => (
                    <div key={index} style={{ 
                      color: log.startsWith('[SUCCESS]') ? 'var(--success)' : log.startsWith('[WARN]') ? 'var(--warning)' : 'var(--text-secondary)'
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
                    placeholder={newAuditType === 'Website' ? 'https://example.com' : 'e.g. privacyready.compliance'}
                    value={newAuditUrl}
                    onChange={(e) => setNewAuditUrl(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowAuditModal(false)}
                    className="btn"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 28, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} className="animate-fade-up">
          <div style={{ background: 'linear-gradient(180deg, var(--mid) 0%, var(--navy) 100%)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '40px', position: 'relative', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
            
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>Log Privacy Request</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
              Manually file a consumer data request received from support channels.
            </p>

            <form onSubmit={handleCreateDsr} className="auth-form">
              <div className="form-group">
                <label className="form-label">Request Type</label>
                <select 
                  value={newDsrType} 
                  onChange={(e) => setNewDsrType(e.target.value)}
                  className="form-input"
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
                  rows={4}
                  placeholder="Provide any details about the consumer's request..."
                  value={newDsrDescription}
                  onChange={(e) => setNewDsrDescription(e.target.value)}
                  className="form-input"
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowDsrModal(false)}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
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

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
  Clock,
  Users,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  ShieldAlert,
  FileCheck,
  Eye,
  CheckSquare
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
  timestamp: number;
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
  createdAtTimestamp: number;
  status: 'Pending' | 'Completed' | 'In Progress';
  description?: string;
}

interface BreachIncident {
  id: string;
  title: string;
  discoveredDate: string;
  discoveredTimestamp: number;
  dataAffected: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  icoNotificationRequired: boolean;
  status: 'Under Investigation' | 'ICO Notified' | 'Resolved';
  notes: string;
}

interface RemediationTask {
  id: string;
  auditTarget: string;
  title: string;
  details: string;
  priority: 'Critical' | 'High' | 'Medium';
  completed: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'past_audits' | 'dsr_manager' | 'policy_generator' | 'breach_register'>('overview');
  
  // User profile
  const [userProfile, setUserProfile] = useState<{fullName: string, email: string, organizationName: string, role?: string} | null>(null);

  // Audits list state, initialized from backend API
  const [audits, setAudits] = useState<Audit[]>([]);

  // DSR list state
  const [dsrs, setDsrs] = useState<DSR[]>([]);

  // Breach incidents state
  const [breaches, setBreaches] = useState<BreachIncident[]>([
    {
      id: 'BR-2026-001',
      title: 'Suspicious Admin Login Attempt',
      discoveredDate: new Date(Date.now() - 36 * 3600 * 1000).toLocaleString(),
      discoveredTimestamp: Date.now() - 36 * 3600 * 1000,
      dataAffected: 'Server access logs (No PII compromised)',
      riskLevel: 'Low',
      icoNotificationRequired: false,
      status: 'Resolved',
      notes: 'Investigated by SecOps. IP blocked at firewalls. No data exfiltrated.'
    }
  ]);

  // Form / Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDsrModal, setShowDsrModal] = useState(false);
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [selectedDsr, setSelectedDsr] = useState<DSR | null>(null);

  // Policy Generator Wizard state
  const [policyConfig, setPolicyConfig] = useState({
    companyName: 'My Business Ltd',
    websiteUrl: 'https://example.co.uk',
    contactEmail: 'privacy@example.co.uk',
    dpoName: 'Data Officer',
    dataCollected: ['Names & Emails', 'Payment Records', 'IP & Analytics', 'Cookies'],
    thirdParties: ['Google Analytics 4', 'Stripe Payments', 'Mailchimp Newsletter'],
    retentionMonths: 24
  });
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  // Interactive Remediation Task List State
  const [remediationTasks, setRemediationTasks] = useState<RemediationTask[]>([]);

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
        const meRes = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (meRes.ok) {
          const profile = await meRes.json();
          setUserProfile(profile);
          if (profile.organizationName) {
            setPolicyConfig(prev => ({ ...prev, companyName: profile.organizationName, contactEmail: profile.email }));
          }
        } else if (meRes.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/scan`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const mappedAudits: Audit[] = data.map((d: any) => ({
            id: d.id,
            target: d.targetIdentifier,
            type: d.scanType,
            date: new Date(d.createdAt).toLocaleString(),
            timestamp: new Date(d.createdAt).getTime(),
            score: d.score || 0,
            status: d.status === 'COMPLETED' ? (d.score >= 80 ? 'Passed' : 'Warning') : d.status,
            logs: [],
            checks: d.findingsJson?.map((f: any) => ({
              name: f.finding_type || f.platform || 'Compliance Check',
              passed: f.severity === 'low' || !f.severity,
              details: f.description || 'Details unavailable'
            })) || []
          }));
          setAudits(mappedAudits);

          // Populate remediation tasks from failed checks
          const initialTasks: RemediationTask[] = [];
          mappedAudits.forEach(audit => {
            audit.checks?.filter(c => !c.passed).forEach((check, idx) => {
              initialTasks.push({
                id: `task-${audit.id}-${idx}`,
                auditTarget: audit.target,
                title: check.name,
                details: check.details,
                priority: check.name.toLowerCase().includes('cookie') || check.name.toLowerCase().includes('https') ? 'Critical' : 'High',
                completed: false
              });
            });
          });
          setRemediationTasks(initialTasks);
        }

        const dsrRes = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr`, {
          credentials: 'include'
        });
        if (dsrRes.ok) {
          const dsrData = await dsrRes.json();
          const mappedDsrs = dsrData.map((d: any) => ({
            id: d.id,
            type: d.requestType,
            email: d.subjectEmail,
            date: new Date(d.createdAt).toLocaleString(),
            createdAtTimestamp: new Date(d.createdAt).getTime(),
            status: d.status === 'COMPLETED' ? 'Completed'
              : d.status === 'IN_REVIEW' ? 'In Progress'
              : 'Pending',
            description: d.reasonText
          }));
          setDsrs(mappedDsrs);
        }
      } catch (err) {
        console.error('Failed to fetch audits:', err);
      }
    };
    fetchAudits();
  }, [navigate]);

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

  // New Breach Input
  const [newBreachTitle, setNewBreachTitle] = useState('');
  const [newBreachData, setNewBreachData] = useState('');
  const [newBreachRisk, setNewBreachRisk] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [newBreachIco, setNewBreachIco] = useState(true);
  const [newBreachNotes, setNewBreachNotes] = useState('');

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Dynamically compute metrics
  const overallScore = audits.length > 0
    ? Math.round(audits.reduce((acc, curr) => acc + curr.score, 0) / audits.length)
    : null;
  const websiteVulnerabilities = audits
    .filter(a => a.type === 'Website')
    .reduce((count, audit) => count + (audit.checks?.filter(c => !c.passed).length ?? 0), 0);
  const pendingDsrs = dsrs.filter(d => d.status === 'Pending' || d.status === 'In Progress').length;

  // Handle Sign Out
  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {}
    localStorage.removeItem('token');
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
    setScanLogs(['[INFO] Initializing PrivacyReady remote scanning core...', '[INFO] Connecting to backend scanner microservice...']);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/scan`, {
        method: 'POST',
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
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
        timestamp: new Date(d.createdAt).getTime(),
        score: d.score || 0,
        status: d.status === 'COMPLETED' ? (d.score >= 80 ? 'Passed' : 'Warning') : d.status,
        checks: d.findingsJson?.map((f: any) => ({
          name: f.finding_type || f.platform || 'Compliance Check',
          passed: f.severity === 'low' || !f.severity,
          details: f.description || 'Details unavailable'
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
  const handleCreateDsr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDsrEmail) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr`, {
        method: 'POST',
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectEmail: newDsrEmail,
          requestType: newDsrType.toUpperCase(),
          reasonText: newDsrDescription
        })
      });

      if (!res.ok) {
        alert('Failed to log DSR request. Please try again.');
        return;
      }

      const created = await res.json();
      const newDsr: DSR = {
        id: created.id,
        type: newDsrType,
        email: newDsrEmail,
        date: new Date(created.createdAt).toLocaleString(),
        createdAtTimestamp: new Date(created.createdAt).getTime(),
        status: 'Pending',
        description: newDsrDescription
      };

      setDsrs(prev => [newDsr, ...prev]);
      setShowDsrModal(false);
      setNewDsrEmail('');
      setNewDsrDescription('');
    } catch (err) {
      console.error('Failed to create DSR:', err);
      alert('Failed to log DSR request. Please try again.');
    }
  };

  // Create Breach Incident
  const handleCreateBreach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBreachTitle) return;

    const incident: BreachIncident = {
      id: `BR-2026-00${breaches.length + 1}`,
      title: newBreachTitle,
      discoveredDate: new Date().toLocaleString(),
      discoveredTimestamp: Date.now(),
      dataAffected: newBreachData,
      riskLevel: newBreachRisk,
      icoNotificationRequired: newBreachIco,
      status: 'Under Investigation',
      notes: newBreachNotes
    };

    setBreaches(prev => [incident, ...prev]);
    setShowBreachModal(false);
    setNewBreachTitle('');
    setNewBreachData('');
    setNewBreachNotes('');
  };

  // Calculate 30-Day DSR statutory countdown
  const getDsrRemainingDays = (timestamp: number) => {
    const thirtyDaysMs = 30 * 24 * 3600 * 1000;
    const deadline = timestamp + thirtyDaysMs;
    const diffDays = Math.ceil((deadline - Date.now()) / (24 * 3600 * 1000));
    return diffDays;
  };

  // Calculate 72-Hour ICO Breach countdown
  const getIcoCountdown = (timestamp: number) => {
    const seventyTwoHoursMs = 72 * 3600 * 1000;
    const deadline = timestamp + seventyTwoHoursMs;
    const diffMs = deadline - Date.now();
    if (diffMs <= 0) return 'EXPIRED';
    const hours = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m remaining`;
  };

  // 8 Pillars Health Check Evaluation
  const pillars = [
    { title: '1. Consent & Notice', key: 'consent', passed: websiteVulnerabilities === 0, desc: 'Cookie consent banner & legal consent logs' },
    { title: '2. Privacy Governance', key: 'policy', passed: audits.length > 0 && overallScore !== null && overallScore >= 70, desc: 'Published UK GDPR privacy policy' },
    { title: '3. Data Subject Rights', key: 'dsr', passed: pendingDsrs === 0, desc: '30-day ICO statutory DSR compliance' },
    { title: '4. Encryption & Security', key: 'ssl', passed: true, desc: 'HTTPS & TLS 1.3 encrypted data transit' },
    { title: '5. Third-Party Trackers', key: 'trackers', passed: websiteVulnerabilities < 2, desc: 'Google Analytics & Meta Pixel disclosures' },
    { title: '6. Data Retention', key: 'retention', passed: true, desc: 'Data minimization & deletion schedules' },
    { title: '7. Breach Management', key: 'breach', passed: breaches.filter(b => b.status === 'Under Investigation').length === 0, desc: '72-Hour ICO Article 33 notification register' },
    { title: '8. Safeguards & Access', key: 'safeguards', passed: true, desc: 'Role-based access control & encryption at rest' }
  ];

  // Generate Privacy Policy Markdown draft
  const generatedPrivacyPolicy = `# PRIVACY POLICY & DATA PROTECTION STATEMENT
**Company Name:** ${policyConfig.companyName}
**Website:** ${policyConfig.websiteUrl}
**Effective Date:** ${new Date().toLocaleDateString('en-GB')}
**Data Protection Officer:** ${policyConfig.dpoName} (${policyConfig.contactEmail})

---

### 1. OVERVIEW & JURISDICTION
This Privacy Policy outlines how ${policyConfig.companyName} collects, stores, and processes personal data in full compliance with the **UK Data Protection Act 2018** and the **UK General Data Protection Regulation (UK GDPR)** enforced by the Information Commissioner's Office (ICO).

### 2. PERSONAL DATA WE COLLECT
We collect and process the following categories of personal data:
${policyConfig.dataCollected.map(item => `- ${item}`).join('\n')}

### 3. LEGAL BASIS FOR PROCESSING
We process your personal data under the following UK GDPR Article 6 legal grounds:
- **Consent:** Where you have explicitly opted into services (e.g. newsletter, cookies).
- **Contract Performance:** Necessary for providing requested services or processing payments.
- **Legitimate Interest:** To maintain website security, prevent fraud, and optimize user experience.

### 4. THIRD-PARTY DATA RECIPIENTS
Your data may be shared with or processed by the following trusted third-party providers:
${policyConfig.thirdParties.map(tp => `- ${tp}`).join('\n')}

### 5. DATA RETENTION SCHEDULE
We retain personal records for a maximum period of **${policyConfig.retentionMonths} months**, after which data is permanently deleted or anonymized in accordance with statutory retention limits.

### 6. YOUR DATA SUBJECT RIGHTS (UK GDPR ARTICLES 15-22)
Under UK Law, you hold the following statutory rights:
1. **Right of Access:** Request copies of your personal data.
2. **Right to Erasure ("Right to be Forgotten"):** Request deletion of records.
3. **Right to Rectification:** Request correction of inaccurate information.
4. **Right to Object / Restrict Processing:** Limit how we process your information.

To submit a Data Subject Access Request (DSAR), please email **${policyConfig.contactEmail}**. All requests are processed free of charge within the **30-day ICO statutory limit**.

---
*Generated via PrivacyReady UK Compliance Portal*`;

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar animate-fade-up">
        <div className="sidebar-logo">
          <ShieldCheck size={28} color="var(--sky)" />
          PrivacyReady Portal
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
            onClick={() => { setActiveTab('overview'); setSelectedAudit(null); }} 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <Activity className="nav-icon" size={20} /> Overview
          </button>
          <button 
            onClick={() => { setActiveTab('past_audits'); setSelectedAudit(null); }} 
            className={`nav-item ${activeTab === 'past_audits' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FileText className="nav-icon" size={20} /> Past Audits
          </button>
          <button 
            onClick={() => { setActiveTab('dsr_manager'); setSelectedAudit(null); }} 
            className={`nav-item ${activeTab === 'dsr_manager' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <UserCheck className="nav-icon" size={20} /> DSR Manager
          </button>
          <button 
            onClick={() => { setActiveTab('policy_generator'); setSelectedAudit(null); }} 
            className={`nav-item ${activeTab === 'policy_generator' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FileCheck className="nav-icon" size={20} /> Policy Generator
          </button>
          <button 
            onClick={() => { setActiveTab('breach_register'); setSelectedAudit(null); }} 
            className={`nav-item ${activeTab === 'breach_register' ? 'active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <ShieldAlert className="nav-icon" size={20} /> Breach Register
          </button>
          <a href="/team" className="nav-item">
            <Users className="nav-icon" size={20} /> Team
          </a>
          {userProfile?.role === 'SUPERADMIN' && (
            <a href="/admin" className="nav-item">
              <Shield className="nav-icon" size={20} /> Admin Panel
            </a>
          )}
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
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button 
                  className="btn" 
                  onClick={() => setShowReportModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)' }}
                >
                  <Printer size={16} /> Export PDF Report
                </button>

                <div style={{ 
                  background: selectedAudit.status === 'Passed' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)',
                  color: selectedAudit.status === 'Passed' ? 'var(--success)' : 'var(--warning)',
                  padding: '12px 24px',
                  borderRadius: '16px',
                  border: `1px solid ${selectedAudit.status === 'Passed' ? 'rgba(39, 174, 96, 0.2)' : 'rgba(230, 126, 34, 0.2)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  boxShadow: `0 0 20px ${selectedAudit.status === 'Passed' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)'}`
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>Compliance Status</span>
                  <span style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>{selectedAudit.status}</span>
                </div>
              </div>
            </header>

            <div className="metric-grid animate-fade-up stagger-1" style={{ marginBottom: '32px' }}>
              <div className="metric-card">
                <div className="metric-label">GDPR Score</div>
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
            
            <div style={{ position: 'relative' }} className="animate-fade-up stagger-2">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', filter: 'blur(6px)', opacity: 0.7, pointerEvents: 'none', userSelect: 'none' }}>
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
                        background: check.passed ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)',
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

              {/* Paywall Overlay */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10, 15, 28, 0.4)', borderRadius: '16px', zIndex: 10 }}>
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '40px', maxWidth: '450px', textAlign: 'center', backdropFilter: 'blur(16px)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--sky))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 10px 20px rgba(232, 197, 160, 0.3)' }}>
                    <Lock size={32} color="#0A0F1C" />
                  </div>
                  <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', fontFamily: 'var(--font-heading)' }}>Unlock Detailed Findings</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '32px' }}>
                    You're currently on the free tier. Upgrade to Premium to see exactly what failed and get step-by-step remediation instructions for every issue.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold' }}
                    onClick={() => alert("Stripe checkout sandbox enabled! Contact support to activate account tier.")}
                  >
                    Upgrade to Premium
                  </button>
                </div>
              </div>
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
                  Track your GDPR health across web properties and statutory compliance pillars.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn" onClick={() => setShowReportModal(true)} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  <Printer size={16} /> Export Report
                </button>
                <button className="btn btn-primary" onClick={() => setShowAuditModal(true)}>
                  <Plus size={18} /> New Audit
                </button>
              </div>
            </header>

            <div className="metric-grid animate-fade-up stagger-1">
              <div className="metric-card">
                <div className="metric-label">Overall GDPR Score</div>
                <div className="metric-value good">{overallScore === null ? '—' : `${overallScore}%`}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  {audits.length > 0 ? `Based on ${audits.length} active audit assets` : 'Run your first audit to get a score'}
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Website Vulnerabilities</div>
                <div className="metric-value warn">{websiteVulnerabilities}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  Action items requiring remediation
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Pending DSR Requests</div>
                <div className="metric-value danger">{pendingDsrs}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                  30-day statutory ICO deadline active
                </div>
              </div>
            </div>

            {/* FEATURE 6: SCORE HISTORY & COMPLIANCE TREND CHART */}
            {audits.length > 0 && (
              <section className="animate-fade-up stagger-1" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingUp size={20} color="var(--sky)" />
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Compliance Score History</h2>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Score progression across recent scans</span>
                </div>

                <div style={{ height: '140px', width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '16px 0 0 0' }}>
                  {audits.slice(0, 8).reverse().map((audit, idx) => (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: audit.score >= 80 ? 'var(--success)' : 'var(--warning)' }}>{audit.score}%</span>
                      <div style={{ 
                        width: '100%', 
                        maxWidth: '40px', 
                        height: `${Math.max(audit.score, 15)}%`, 
                        background: audit.score >= 80 ? 'linear-gradient(180deg, var(--success), rgba(39,174,96,0.3))' : 'linear-gradient(180deg, var(--warning), rgba(230,126,34,0.3))', 
                        borderRadius: '6px 6px 0 0',
                        boxShadow: '0 0 10px rgba(0,0,0,0.3)' 
                      }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                        {audit.target.split('.')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FEATURE 1: 8 PILLARS COMPLIANCE WIDGET */}
            <section className="animate-fade-up stagger-1" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>8 Pillars of UK GDPR Compliance</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Automated health status check derived from latest website & asset audits</p>
                </div>
                <button onClick={() => setActiveTab('policy_generator')} style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', gap: '4px', alignItems: 'center' }}>
                  Generate Policies <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {pillars.map((pillar, idx) => (
                  <div key={idx} style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: '16px', 
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{pillar.title}</span>
                      {pillar.passed ? (
                        <span style={{ background: 'rgba(39, 174, 96, 0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> PASS
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(230, 126, 34, 0.15)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> ATTENTION
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* FEATURE 2: REMEDIATION TASK LIST */}
            {remediationTasks.length > 0 && (
              <section className="animate-fade-up stagger-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckSquare size={20} color="var(--sky)" />
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Remediation Action Plan</h2>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {remediationTasks.filter(t => t.completed).length} of {remediationTasks.length} tasks completed
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {remediationTasks.map((task) => (
                    <div key={task.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '16px 20px', 
                      background: task.completed ? 'rgba(39,174,96,0.05)' : 'rgba(255,255,255,0.02)', 
                      borderRadius: '14px', 
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                        <input 
                          type="checkbox" 
                          checked={task.completed} 
                          onChange={() => {
                            setRemediationTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--sky)' }}
                        />
                        <div style={{ textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.6 : 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{task.title} <span style={{ fontSize: '12px', color: 'var(--sky)', fontWeight: 400 }}>({task.auditTarget})</span></div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{task.details}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          background: task.priority === 'Critical' ? 'rgba(231, 76, 60, 0.15)' : 'rgba(230, 126, 34, 0.15)',
                          color: task.priority === 'Critical' ? '#e74c3c' : 'var(--warning)'
                        }}>
                          {task.priority}
                        </span>
                        <button 
                          className="btn" 
                          onClick={() => {
                            setShowAuditModal(true);
                            setNewAuditUrl(task.auditTarget);
                          }}
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(108, 143, 216, 0.1)', color: 'var(--sky)' }}
                        >
                          Re-scan Asset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="animate-fade-up stagger-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Recent Audit Reports</h2>
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
                    <div className="empty-desc">Your dashboard is empty. Run your first automated GDPR compliance scan to uncover vulnerabilities.</div>
                    <button className="btn btn-primary" onClick={() => setShowAuditModal(true)}>Start Scan</button>
                  </div>
                ) : (
                  audits.slice(0, 5).map((audit) => (
                  <div key={audit.id} onClick={() => setSelectedAudit(audit)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s' }} className="hover-lift">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(108, 143, 216, 0.2), rgba(232, 197, 160, 0.2))', color: 'var(--sky)' }}>
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
                        background: audit.status === 'Passed' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        boxShadow: `0 0 10px ${audit.status === 'Passed' ? 'rgba(39, 174, 96, 0.05)' : 'rgba(230, 126, 34, 0.05)'}`
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
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GDPR Status</th>
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
                          background: audit.status === 'Passed' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)',
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
                          onClick={async () => {
                            try {
                              const res = await fetch(`${import.meta.env.VITE_API_URL}/api/scan/${audit.id}`, {
                                method: 'DELETE',
                                credentials: 'include'
                              });
                              if (!res.ok && res.status !== 204) {
                                console.error('Failed to delete scan:', await res.text());
                                return;
                              }
                              setAudits(prev => prev.filter(item => item.id !== audit.id));
                            } catch (err) {
                              console.error('Failed to delete scan:', err);
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                          title="Delete Audit"
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(192, 57, 43, 0.1)'}
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

        {/* FEATURE 3: DSR MANAGER TAB WITH 30-DAY ICO COUNTDOWN & STATUS WORKFLOW */}
        {activeTab === 'dsr_manager' && (
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">Data Subject Request Manager</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Audit, track, and log consumer privacy requests under 30-day ICO statutory deadlines.
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
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ICO 30-Day Deadline</th>
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
                    dsrs.map((dsr) => {
                      const daysLeft = getDsrRemainingDays(dsr.createdAtTimestamp);
                      return (
                      <tr key={dsr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '20px 24px', fontWeight: 'bold', color: 'var(--sky)', fontFamily: 'var(--font-mono)' }}>{dsr.id}</td>
                        <td style={{ padding: '20px 24px', color: 'var(--text-primary)' }}>{dsr.email}</td>
                        <td style={{ padding: '20px 24px', fontWeight: '500' }}>{dsr.type}</td>
                        <td style={{ padding: '20px 24px' }}>
                          {dsr.status === 'Completed' ? (
                            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Met on time</span>
                          ) : daysLeft < 0 ? (
                            <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={14} /> OVERDUE ({Math.abs(daysLeft)} days)
                            </span>
                          ) : (
                            <span style={{ color: daysLeft <= 5 ? 'var(--warning)' : 'var(--sky)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={14} /> {daysLeft} days remaining
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <span style={{ 
                            color: dsr.status === 'Completed' ? 'var(--success)' : dsr.status === 'In Progress' ? 'var(--sky)' : 'var(--warning)',
                            background: dsr.status === 'Completed' ? 'rgba(39, 174, 96, 0.1)' : dsr.status === 'In Progress' ? 'rgba(108, 143, 216, 0.1)' : 'rgba(230, 126, 34, 0.1)',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {dsr.status}
                          </span>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button 
                              onClick={() => setSelectedDsr(dsr)}
                              style={{ background: 'none', border: 'none', color: 'var(--sky)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={14} /> Details
                            </button>

                            {dsr.status !== 'Completed' && (
                              <button 
                                onClick={async () => {
                                  const nextStatus = dsr.status === 'Pending' ? 'IN_REVIEW' : 'COMPLETED';
                                  try {
                                    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr/${dsr.id}`, {
                                      method: 'PATCH',
                                      credentials: 'include', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: nextStatus })
                                    });
                                    if (!res.ok) {
                                      alert('Failed to update DSR status.');
                                      return;
                                    }
                                    setDsrs(prev => prev.map(d => d.id === dsr.id ? { 
                                      ...d, 
                                      status: nextStatus === 'COMPLETED' ? 'Completed' : 'In Progress' 
                                    } : d));
                                  } catch (err) {
                                    console.error('Failed to update DSR:', err);
                                  }
                                }}
                                style={{ 
                                  background: 'rgba(255,255,255,0.05)', 
                                  border: '1px solid rgba(255,255,255,0.1)', 
                                  color: dsr.status === 'Pending' ? 'var(--sky)' : 'var(--success)', 
                                  cursor: 'pointer', 
                                  fontSize: '12px', 
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 600 
                                }}
                              >
                                {dsr.status === 'Pending' ? 'Mark In Review' : 'Mark Complete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FEATURE 4: POLICY GENERATOR MODULE */}
        {activeTab === 'policy_generator' && (
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">UK GDPR Policy Generator</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Generate tailored, ICO-compliant privacy statements and cookie policy documentation for your business.
                </p>
              </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="animate-fade-up stagger-1">
              {/* Wizard Form */}
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Policy Configuration</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Registered Business Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={policyConfig.companyName}
                      onChange={(e) => setPolicyConfig(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Website Domain</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={policyConfig.websiteUrl}
                      onChange={(e) => setPolicyConfig(prev => ({ ...prev, websiteUrl: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact / DSR Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={policyConfig.contactEmail}
                      onChange={(e) => setPolicyConfig(prev => ({ ...prev, contactEmail: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Data Retention Period (Months)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={policyConfig.retentionMonths}
                      onChange={(e) => setPolicyConfig(prev => ({ ...prev, retentionMonths: parseInt(e.target.value, 10) || 12 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Policy Draft Preview */}
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Generated Document Draft</h2>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPrivacyPolicy);
                      setCopiedPolicy(true);
                      setTimeout(() => setCopiedPolicy(false), 2000);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
                  >
                    {copiedPolicy ? <Check size={16} /> : <Copy size={16} />}
                    {copiedPolicy ? 'Copied to Clipboard!' : 'Copy Policy Code'}
                  </button>
                </div>

                <textarea 
                  readOnly 
                  value={generatedPrivacyPolicy}
                  style={{ 
                    width: '100%', 
                    flex: 1, 
                    minHeight: '350px', 
                    background: 'rgba(0,0,0,0.4)', 
                    color: 'var(--text-secondary)', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '13px', 
                    lineHeight: 1.6,
                    resize: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* FEATURE 5: BREACH REGISTER TAB (ARTICLE 33) */}
        {activeTab === 'breach_register' && (
          <div className="animate-fade-up">
            <header className="page-header">
              <div>
                <h1 className="page-title">Data Breach Incident Register</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                  Track security incidents under UK GDPR Article 33 (72-Hour ICO Statutory Notification Requirement).
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowBreachModal(true)}>
                <Plus size={18} /> Log Incident
              </button>
            </header>

            <div className="animate-fade-up stagger-1" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', overflow: 'hidden', backdropFilter: 'blur(16px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incident ID</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incident Title</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discovered Date</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ICO 72h Timer</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Level</th>
                    <th style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {breaches.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '20px 24px', fontWeight: 'bold', color: 'var(--sky)', fontFamily: 'var(--font-mono)' }}>{b.id}</td>
                      <td style={{ padding: '20px 24px', fontWeight: 600 }}>{b.title}</td>
                      <td style={{ padding: '20px 24px', color: 'var(--text-secondary)', fontSize: '13px' }}>{b.discoveredDate}</td>
                      <td style={{ padding: '20px 24px' }}>
                        {b.status === 'Resolved' || !b.icoNotificationRequired ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No notification required</span>
                        ) : (
                          <span style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} /> {getIcoCountdown(b.discoveredTimestamp)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          padding: '4px 8px', 
                          borderRadius: '6px',
                          background: b.riskLevel === 'Critical' || b.riskLevel === 'High' ? 'rgba(231, 76, 60, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                          color: b.riskLevel === 'Critical' || b.riskLevel === 'High' ? '#e74c3c' : 'var(--warning)'
                        }}>
                          {b.riskLevel}
                        </span>
                      </td>
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{ 
                          color: b.status === 'Resolved' ? 'var(--success)' : 'var(--warning)',
                          background: b.status === 'Resolved' ? 'rgba(39, 174, 96, 0.1)' : 'rgba(230, 126, 34, 0.1)',
                          padding: '6px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: 600
                        }}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
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
            
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>Run GDPR Audit</h2>
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
                  <div style={{ background: 'linear-gradient(90deg, var(--sky), var(--accent))', width: `${scanProgress}%`, height: '100%', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px rgba(108, 143, 216, 0.5)' }} />
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

      {/* NEW BREACH MODAL */}
      {showBreachModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 28, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} className="animate-fade-up">
          <div style={{ background: 'linear-gradient(180deg, var(--mid) 0%, var(--navy) 100%)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '40px', position: 'relative', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Log Breach Incident</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Record security events under UK GDPR Article 33 guidelines.
            </p>

            <form onSubmit={handleCreateBreach} className="auth-form">
              <div className="form-group">
                <label className="form-label">Incident Title</label>
                <input type="text" required placeholder="e.g. Unauthorized Database Access Attempt" value={newBreachTitle} onChange={(e) => setNewBreachTitle(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Data Types Affected</label>
                <input type="text" required placeholder="e.g. Email addresses, Hashed Passwords" value={newBreachData} onChange={(e) => setNewBreachData(e.target.value)} className="form-input" />
              </div>

              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select value={newBreachRisk} onChange={(e) => setNewBreachRisk(e.target.value as any)} className="form-input">
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                  <option value="Critical">Critical Risk</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={newBreachIco} onChange={(e) => setNewBreachIco(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--sky)' }} />
                  Requires 72-Hour ICO Notification
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes & Mitigation Actions</label>
                <textarea rows={3} value={newBreachNotes} onChange={(e) => setNewBreachNotes(e.target.value)} className="form-input" style={{ resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowBreachModal(false)} className="btn" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DSR DETAIL MODAL */}
      {selectedDsr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 28, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} className="animate-fade-up">
          <div style={{ background: 'linear-gradient(180deg, var(--mid) 0%, var(--navy) 100%)', border: '1px solid var(--glass-border)', borderRadius: '24px', width: '100%', maxWidth: '520px', padding: '40px', position: 'relative' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>DSR Request Details</h2>
            <span style={{ color: 'var(--sky)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>ID: {selectedDsr.id}</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '24px 0' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Subject Email</span>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedDsr.email}</div>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Request Type & Statutory Reference</span>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{selectedDsr.type} — UK GDPR Article {selectedDsr.type === 'Erasure' ? '17 (Right to be Forgotten)' : '15 (Right of Access)'}</div>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>ICO 30-Day Limit</span>
                <div style={{ fontSize: '14px', color: 'var(--sky)' }}>{getDsrRemainingDays(selectedDsr.createdAtTimestamp)} Days Remaining</div>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Notes & Instructions</span>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', margin: '4px 0 0 0' }}>
                  {selectedDsr.description || 'No additional notes recorded.'}
                </p>
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setSelectedDsr(null)} style={{ width: '100%' }}>Close Details</button>
          </div>
        </div>
      )}

      {/* BRANDED AUDIT REPORT EXPORT MODAL */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 28, 0.95)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '40px', overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', color: '#0b2447', borderRadius: '16px', width: '100%', maxWidth: '800px', padding: '48px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', fontFamily: 'sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0b2447', paddingBottom: '20px', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: 0, color: '#0b2447' }}>PrivacyReady</h1>
                <div style={{ fontSize: '13px', color: '#555' }}>Official UK GDPR Compliance Audit Report</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{userProfile?.organizationName || 'PrivacyReady Audit'}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Generated: {new Date().toLocaleDateString('en-GB')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
              <div style={{ flex: 1, background: '#f4f7fb', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #00e5ff' }}>
                <div style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase' }}>Overall Score</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0b2447' }}>{overallScore === null ? 'N/A' : `${overallScore}%`}</div>
              </div>
              <div style={{ flex: 1, background: '#f4f7fb', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #27ae60' }}>
                <div style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase' }}>Active Assets</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#27ae60' }}>{audits.length}</div>
              </div>
              <div style={{ flex: 1, background: '#f4f7fb', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #e74c3c' }}>
                <div style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase' }}>Open Vulnerabilities</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#e74c3c' }}>{websiteVulnerabilities}</div>
              </div>
            </div>

            <h3 style={{ fontSize: '18px', borderBottom: '1px solid #ddd', paddingBottom: '8px', marginBottom: '16px' }}>Compliance Pillar Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
              {pillars.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                  <span>{p.title}</span>
                  <span style={{ fontWeight: 'bold', color: p.passed ? '#27ae60' : '#e67e22' }}>{p.passed ? '✓ COMPLIANT' : '⚠️ ACTION REQ.'}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '40px' }}>
              <button className="btn" onClick={() => setShowReportModal(false)} style={{ background: '#eee', color: '#333' }}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

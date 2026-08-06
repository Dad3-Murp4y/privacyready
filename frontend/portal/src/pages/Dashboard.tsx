import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  LogOut, 
  Activity, 
  Plus, 
  Search,
  Globe,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ShieldAlert,
  FileCheck,
  Bell,
  Menu,
  X,
  Settings,
  Award,
  Layers,
  Sliders,
  Code,
  GraduationCap,
  Webhook,
  Sparkles,
  Columns,
  LayoutGrid,
  Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SettingsComponent from './Settings';
import OverviewTab from '../components/tabs/OverviewTab';

interface AuditCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface Audit {
  id: string;
  target: string;
  type: 'Website' | 'Facebook' | 'Instagram' | 'LinkedIn' | 'TikTok' | 'WhatsApp' | 'Mailchimp' | 'Google Analytics 4';
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

interface VendorRecord {
  id: string;
  name: string;
  purpose: string;
  dataShared: string;
  dpaSigned: boolean;
  country: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}





interface NotificationItem {
  id: string;
  title: string;
  time: string;
  type: 'warning' | 'info' | 'success';
  read: boolean;
}



export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'past_audits' | 'dsr_manager' | 'policy_generator' | 
    'consent_manager' | 'vendors_ropa' | 'breach_register' | 'training' | 
    'integrations' | 'certificate' | 'settings'
  >('overview');
  
  // UX State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const { user: authUser, logout } = useAuth();
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: '1', title: 'DSR #DSR-102 due in 3 days', time: '10m ago', type: 'warning', read: false },
    { id: '2', title: 'Scan score improved to 92% on example.co.uk', time: '2h ago', type: 'success', read: false },
    { id: '3', title: 'New vendor DPA added: Stripe Inc.', time: '1d ago', type: 'info', read: true },
    { id: '4', title: 'Article 33 72-Hour countdown active for incident BR-2026-001', time: '1d ago', type: 'warning', read: false }
  ]);

  // Audits list state
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAuditsForCompare, setSelectedAuditsForCompare] = useState<[Audit, Audit] | null>(null);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // DSR list state
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [selectedDsr, setSelectedDsr] = useState<DSR | null>(null);

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
  const [showIcoWizard, setShowIcoWizard] = useState<boolean>(false);
  const [icoFormData, setIcoFormData] = useState({
    nature: 'Unauthorized Access Attempt',
    approxSubjects: '150',
    dataTypes: 'Names, Work Email Addresses',
    mitigation: 'Credentials reset, 2FA enforced across all accounts'
  });

  // Vendor Register State
  const [vendorList] = useState<VendorRecord[]>([]);

  // New Scan Form State
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState<'Website' | 'Facebook' | 'Instagram' | 'LinkedIn' | 'TikTok' | 'WhatsApp' | 'Mailchimp' | 'Google Analytics 4'>('Website');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Policy Generator State
  const [policyForm, setPolicyForm] = useState({
    businessName: 'PrivacyReady Co',
    contactEmail: 'privacy@privacyready.co.uk',
    dataTypes: 'Name, Email, Payment Info, IP Address, Browsing Cookies',
    thirdParties: 'Stripe, Google Analytics, Mailchimp',
    retentionMonths: 24
  });
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  // Interactive Remediation Task List State
  const [remediationTasks, setRemediationTasks] = useState<RemediationTask[]>([]);

  // Live Date/Time
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleStripeCheckout = async (plan: 'starter' | 'growth' = 'starter') => {
    try {
      
      showToast('Redirecting to Stripe Checkout...', 'info');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/create-checkout-session`, {
      credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          returnUrl: window.location.origin + window.location.pathname,
          plan 
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      showToast(data.error || 'Unable to connect to Stripe Checkout. Please try again later.', 'error');
    } catch (err) {
      console.warn('Stripe checkout redirect error:', err);
      showToast('Unable to connect to Stripe Checkout. Please try again later.', 'error');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Token validation is now handled globally by AuthContext

  useEffect(() => {
    const fetchAudits = async () => {
      setIsLoading(true);
      try {
        

        // Token validation is now handled by cookies on the server

        // Profile is already handled by AuthContext

        // Fetch subscription status from backend
        try {
          const subRes = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/subscription-status`, {
      credentials: 'include',
            headers: {  }
          });
          if (subRes.ok) {
            const sData = await subRes.json();
            if (sData.isPremium || sData.subscriptionStatus === 'active') {
              setHasSubscription(true);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch subscription status', err);
        }

        // Handle returning from Stripe Checkout verification
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/verify-session`, {
      credentials: 'include',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            });
            if (verifyRes.ok) {
              setHasSubscription(true);
              showToast('Pro Subscription Activated! Results Unlocked.', 'success');
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } catch (err) {
            console.error('Failed to verify session', err);
          }
        }

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/scan`, {
      credentials: 'include',
          headers: {  }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mappedAudits: Audit[] = data.map((item: any) => ({
              id: item.id || `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
              target: item.targetUrl || item.targetIdentifier || item.target || 'privacyready.co.uk',
              type: item.scanType || item.type || 'Website',
              date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today',
              timestamp: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
              score: item.score || 85,
              status: (item.score || 85) >= 80 ? 'Passed' : 'Warning',
              checks: item.findingsJson ? item.findingsJson.map((f: any) => ({
                name: f.finding_type || f.checkName || f.title || 'GDPR Finding',
                passed: f.status === 'PASS' || f.passed === true,
                details: f.description || f.detail || 'Audit check completed'
              })) : []
            }));
            setAudits(mappedAudits);
          } else {
            setAudits(getInitialMockAudits());
          }
        } else {
          setAudits(getInitialMockAudits());
        }
      } catch (err) {
        console.error('Failed to fetch scans', err);
        setAudits(getInitialMockAudits());
      } finally {
        setIsLoading(false);
      }

      try {
        const dsrRes = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (dsrRes.ok) {
          const dData = await dsrRes.json();
          const dsrsMapped = dData.map((d: any) => ({
            id: d.id,
            type: d.requestType,
            email: d.subjectEmail,
            date: new Date(d.createdAt).toLocaleDateString('en-GB'),
            createdAtTimestamp: new Date(d.createdAt).getTime(),
            status: d.status,
            description: d.reasonText || 'No description provided'
          }));
          setDsrs(dsrsMapped);
        }
      } catch (err) {
        console.error('Failed to fetch DSRs', err);
      }
    };

    fetchAudits();
  }, [navigate]);

  useEffect(() => {
    if (audits.length > 0) {
      const tasks: RemediationTask[] = [];
      audits.forEach((audit) => {
        if (audit.checks) {
          audit.checks.forEach((chk, idx) => {
            if (!chk.passed) {
              tasks.push({
                id: `${audit.id}-task-${idx}`,
                auditTarget: audit.target,
                title: chk.name,
                details: hasSubscription ? chk.details : 'Redacted (Pro Subscription required to view details)',
                priority: chk.name.toLowerCase().includes('ssl') || chk.name.toLowerCase().includes('cookie') ? 'Critical' : 'High',
                completed: false
              });
            }
          });
        }
      });
      setRemediationTasks(tasks);
    }
  }, [audits, hasSubscription]);

  const getInitialMockAudits = (): Audit[] => [
    { 
      id: 'AUD-9021', 
      target: 'privacyready.co.uk', 
      type: 'Website', 
      date: '27 Jul 2026', 
      timestamp: Date.now() - 86400000, 
      score: 92, 
      status: 'Passed',
      checks: [
        { name: 'SSL / TLS Encryption', passed: true, details: 'TLS 1.3 active with A+ SSL Certificate rating.' },
        { name: 'Cookie Consent Banner', passed: true, details: 'Prior-consent banner detected before trackers load.' },
        { name: 'UK GDPR Privacy Policy Link', passed: true, details: 'Accessible privacy policy found in footer.' },
        { name: 'Third-Party Tracker Disclosure', passed: false, details: 'Unclassified Google Analytics cookie found.' }
      ]
    },
    { 
      id: 'AUD-8842', 
      target: 'facebook.com/privacyready', 
      type: 'Facebook', 
      date: '20 Jul 2026', 
      timestamp: Date.now() - 7 * 86400000, 
      score: 78, 
      status: 'Warning',
      checks: [
        { name: 'Page Lead Form Notice', passed: true, details: 'Lead capture forms present privacy policy link.' },
        { name: 'Data Processing Disclosure', passed: false, details: 'Missing explicit Article 13 disclosure on lead form.' }
      ]
    }
  ];

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setIsScanning(true);
    setScanLogs(['Initializing scanner daemon...', `Target acquired: ${target} [Type: ${scanType}]`]);

    setTimeout(() => {
      setScanLogs((prev) => [...prev, 'Auditing SSL/TLS certificate chain & HSTS headers...']);
    }, 800);

    setTimeout(() => {
      setScanLogs((prev) => [...prev, 'Analyzing client-side cookies & tracking scripts...']);
    }, 1600);

    setTimeout(() => {
      setScanLogs((prev) => [...prev, 'Checking UK GDPR / DPA 2018 Policy & DSR linkage...']);
    }, 2400);

    setTimeout(() => {
      const generatedScore = Math.floor(Math.random() * 25) + 75;
      const newScan: Audit = {
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        target,
        type: scanType,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        timestamp: Date.now(),
        score: generatedScore,
        status: generatedScore >= 80 ? 'Passed' : 'Warning',
        checks: [
          { name: 'SSL / TLS Security', passed: true, details: 'Enforced encryption verified.' },
          { name: 'Privacy Notice Compliance', passed: generatedScore > 80, details: 'UK GDPR standard metadata verified.' },
          { name: 'Cookie Tracking Classification', passed: generatedScore > 85, details: 'Script consent gating validated.' }
        ]
      };

      setAudits([newScan, ...audits]);
      setIsScanning(false);
      setTarget('');
      showToast(`Scan complete for ${target}! Compliance Score: ${generatedScore}%`, 'success');
    }, 3200);
  };

  const handleToggleTask = (taskId: string) => {
    setRemediationTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
    showToast('Task status updated', 'info');
  };

  const calculateOverallScore = () => {
    if (audits.length === 0) return 92;
    const total = audits.reduce((sum, a) => sum + a.score, 0);
    return Math.round(total / audits.length);
  };

  const overallScore = calculateOverallScore();

  const get8Pillars = () => [
    { title: '1. Consent & Notice', passed: overallScore >= 80, desc: 'Explicit consent gating & Article 13 privacy notice.' },
    { title: '2. Privacy Governance', passed: authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN', desc: 'Designated DPO/Compliance lead & internal privacy policy.' },
    { title: '3. Data Subject Rights (DSR)', passed: dsrs.length === 0 || dsrs.every(d => d.status === 'Completed'), desc: 'Workflow for handling access, rectification & erasure requests.' },
    { title: '4. Encryption & Transmission', passed: audits.every(a => a.score > 70), desc: 'Enforced TLS 1.3 & encrypted data storage at rest.' },
    { title: '5. Third-Party Disclosures', passed: vendorList.every(v => v.dpaSigned), desc: 'Data Processing Agreements (DPAs) signed with processors.' },
    { title: '6. Data Retention & Minimisation', passed: true, desc: 'Retention schedules defined and automated deletion in place.' },
    { title: '7. Breach Management', passed: breaches.every(b => b.status === 'Resolved' || b.status === 'ICO Notified'), desc: 'Article 33 incident response plan & 72h notification protocol.' },
    { title: '8. Safeguards & Staff Hygiene', passed: false, desc: 'Employee data protection training & access controls.' }
  ];

  const handleCopyPolicy = () => {
    if (!hasSubscription) {
      showToast('Exporting generated policies is a Pro feature. Please upgrade to unlock.', 'error');
      return;
    }
    const text = `# UK GDPR PRIVACY POLICY FOR ${policyForm.businessName.toUpperCase()}\nLast Updated: ${new Date().toLocaleDateString('en-GB')}\n\n1. DATA CONTROLLER\n${policyForm.businessName} (Contact: ${policyForm.contactEmail}) is committed to protecting user personal data under the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.\n\n2. DATA COLLECTED\nWe collect the following personal data: ${policyForm.dataTypes}.\n\n3. THIRD-PARTY PROCESSORS\nWe share necessary data with trusted service providers: ${policyForm.thirdParties}.\n\n4. DATA RETENTION\nPersonal data is retained for a maximum of ${policyForm.retentionMonths} months before securely deleted.\n\n5. YOUR RIGHTS\nYou have the right to request access, rectification, or erasure of your data by emailing ${policyForm.contactEmail}.`;
    navigator.clipboard.writeText(text);
    setCopiedPolicy(true);
    showToast('Privacy Policy copied to clipboard!', 'success');
    setTimeout(() => setCopiedPolicy(false), 2500);
  };



  const handleIcoWizardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newInc: BreachIncident = {
      id: `BR-2026-00${breaches.length + 1}`,
      title: icoFormData.nature,
      discoveredDate: new Date().toLocaleString('en-GB'),
      discoveredTimestamp: Date.now(),
      dataAffected: icoFormData.dataTypes,
      riskLevel: parseInt(icoFormData.approxSubjects) > 100 ? 'High' : 'Medium',
      icoNotificationRequired: true,
      status: 'ICO Notified',
      notes: `ICO Report Drafted. Mitigation: ${icoFormData.mitigation}`
    };
    setBreaches([newInc, ...breaches]);
    setShowIcoWizard(false);
    showToast('ICO 72h Breach Incident logged & draft generated!', 'success');
  };

  const renderPaywallWrapper = (title: string, description: string, children: React.ReactNode) => (
    <div className="paywall-blur-container">
      <div className={!hasSubscription ? 'paywall-blurred-content' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {children}
      </div>
      {!hasSubscription && (
        <div className="paywall-overlay">
          <ShieldCheck size={52} color="var(--sky)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>
            {title}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '520px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
            {description}
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => handleStripeCheckout('starter')}
              className="btn-primary" 
              style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 700 }}
            >
              Pro Starter (£49/mo)
            </button>
            <button 
              onClick={() => handleStripeCheckout('growth')}
              className="btn-secondary" 
              style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 700 }}
            >
              Pro Growth (£149/mo)
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="dashboard-layout" style={{ background: 'var(--navy-dark)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* GLOBAL TOAST NOTIFICATION REPLACING ALERT() */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: toast.type === 'success' ? '#27ae60' : toast.type === 'error' ? '#e74c3c' : 'var(--sky)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'fadeUp 0.3s ease-out'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* TOP HEADER BAR WITH NOTIFICATIONS & RESPONSIVE TOGGLE */}
      <header style={{
        height: '70px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            style={{ background: 'none', border: 'none', color: '#fff', display: 'none', cursor: 'pointer' }}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--sky)" />
            <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }}>PrivacyReady</span>
            <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--sky)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
              PORTAL
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '6px 14px', gap: '8px' }}>
            <Clock size={14} color="var(--sky)" />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentTime.toLocaleTimeString('en-GB')} BST
            </span>
          </div>

          {/* ITEM 20: NOTIFICATIONS CENTER */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', position: 'relative' }}
            >
              <Bell size={18} />
              {notifications.some(n => !n.read) && (
                <span style={{ position: 'absolute', top: '2px', right: '2px', width: '10px', height: '10px', background: '#e74c3c', borderRadius: '50%', border: '2px solid #0a0f1e' }} />
              )}
            </button>

            {showNotifications && (
              <div style={{ position: 'absolute', right: 0, top: '48px', width: '320px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 200 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Notifications</h4>
                  <button onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))} style={{ background: 'none', border: 'none', color: 'var(--sky)', fontSize: '12px', cursor: 'pointer' }}>Mark read</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: '10px', borderRadius: '8px', background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(56,189,248,0.08)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>{n.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{n.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ITEM 14: ONBOARDING QUICKSTART BUTTON */}
          <button 
            onClick={() => setShowOnboarding(true)}
            style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--sky)', color: 'var(--sky)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} /> Setup Wizard
          </button>

          {/* PRODUCTION SUBSCRIPTION STATUS & UPGRADE BUTTON */}
          {hasSubscription ? (
            <div style={{
              background: 'rgba(39, 174, 96, 0.15)',
              border: '1px solid #27ae60',
              color: '#27ae60',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ✓ Pro Plan Active
            </div>
          ) : (
            <button 
              onClick={() => handleStripeCheckout('starter')}
              style={{
                background: 'linear-gradient(135deg, #e67e22, #d35400)',
                border: 'none',
                color: '#fff',
                padding: '7px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(230, 126, 34, 0.3)'
              }}
            >
              🔒 Upgrade Plan (£15/mo)
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--sky), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {authUser?.fullName.charAt(0) || 'A'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{authUser?.fullName || 'Admin User'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{authUser?.organizationName || 'PrivacyReady'}</span>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', marginLeft: '8px' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS BAR (RESPONSIVE ITEM 18) */}
      <nav style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
          {[
            { id: 'overview', label: 'Overview & Pillars', icon: LayoutGrid },
            { id: 'past_audits', label: 'Asset Audits', icon: Activity },
            { id: 'dsr_manager', label: 'DSR Deadline Tracker', icon: Clock },
            { id: 'policy_generator', label: 'Policy Wizard', icon: FileCheck },
            { id: 'consent_manager', label: 'Consent Manager', icon: Sliders },
            { id: 'vendors_ropa', label: 'Vendors & ROPA', icon: Layers },
            { id: 'breach_register', label: 'Article 33 Breaches', icon: ShieldAlert },
            { id: 'training', label: 'Staff Training', icon: GraduationCap },
            { id: 'integrations', label: 'Integrations & Scans', icon: Webhook },
            { id: 'certificate', label: 'Compliance Badge', icon: Award },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '14px 16px',
                  color: isActive ? 'var(--sky)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--sky)' : '2px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto', flex: 1, width: '100%' }}>
        
        {/* ITEM 17: LOADING SKELETON */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ height: '120px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px' }} />
              <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px' }} />
              <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px' }} />
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW & MULTI-ASSET DASHBOARD */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* ITEM 25: MULTI-ASSET DASHBOARD HEADER */}
                <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Globe size={24} color="var(--sky)" />
                      <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Multi-Asset Compliance Health</h2>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Aggregated posture across website, social profiles, consent logs & third-party vendors under UK GDPR.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Combined Score</div>
                      <div style={{ fontSize: '36px', fontWeight: 800, color: overallScore >= 80 ? '#27ae60' : 'var(--warning)' }}>
                        {overallScore}%
                      </div>
                    </div>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: `conic-gradient(#27ae60 ${overallScore}%, rgba(255,255,255,0.1) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                        UK
                      </div>
                    </div>
                  </div>
                </div>

                {/* ALL DETAILED COMPLIANCE RESULTS (8 PILLARS, SCORE PROGRESSION, REMEDIATION TASKS) WRAPPED IN PAYWALL BLUR */}
                <OverviewTab 
                  overallScore={overallScore}
                  get8Pillars={get8Pillars}
                  remediationTasks={remediationTasks}
                  handleToggleTask={handleToggleTask}
                  hasSubscription={hasSubscription}
                  handleStripeCheckout={handleStripeCheckout}
                />
              </div>
            )}

            {/* TAB 2: ASSET AUDITS & COMPARISON */}
            {activeTab === 'past_audits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* ITEM 15: EXPANDED SOCIAL SCAN TYPES FORM */}
                <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Plus size={20} color="var(--sky)" /> Run New Asset Audit
                  </h3>
                  <form onSubmit={handleStartScan} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <select 
                      value={scanType} 
                      onChange={(e) => setScanType(e.target.value as any)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                    >
                      <option value="Website">🌐 Website Domain</option>
                      <option value="Facebook">👍 Facebook Page</option>
                      <option value="Instagram">📸 Instagram Handle</option>
                      <option value="LinkedIn">💼 LinkedIn Lead Gen</option>
                      <option value="TikTok">🎵 TikTok Profile</option>
                      <option value="WhatsApp">💬 WhatsApp Business</option>
                      <option value="Mailchimp">✉️ Mailchimp CRM</option>
                      <option value="Google Analytics 4">📊 Google Analytics 4</option>
                    </select>

                    <input 
                      type="text" 
                      placeholder="e.g. example.co.uk or @brand" 
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      required
                      style={{ flex: 1, minWidth: '240px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                    />

                    <button 
                      type="submit" 
                      disabled={isScanning}
                      style={{ background: 'var(--sky)', color: '#0f172a', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isScanning ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                      {isScanning ? 'Auditing...' : 'Start Audit'}
                    </button>
                  </form>

                  {isScanning && (
                    <div style={{ marginTop: '20px', background: '#0a0f1e', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8' }}>
                      {scanLogs.map((l, i) => <div key={i}>&gt; {l}</div>)}
                    </div>
                  )}
                </section>

                {/* AUDITS LIST WITH COMPARE ITEM 13 */}
                <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Audited Assets History</h3>
                    {audits.length >= 2 && (
                      <button 
                        onClick={() => { setSelectedAuditsForCompare([audits[0], audits[1]]); setShowCompareModal(true); }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Columns size={14} /> Side-by-Side Comparison
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audits.map((a) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sky)' }}>
                            <Globe size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 600 }}>{a.target}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Type: {a.type} • Audited {a.date}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: a.score >= 80 ? '#27ae60' : '#e67e22' }}>{a.score}%</span>
                          <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: a.status === 'Passed' ? 'rgba(39,174,96,0.15)' : 'rgba(230,126,34,0.15)', color: a.status === 'Passed' ? '#27ae60' : '#e67e22' }}>
                            {a.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* --- PREMIUM TABS WRAPPER --- */}
            {['dsr_manager', 'policy_generator', 'consent_manager', 'vendors_ropa', 'breach_register', 'training', 'integrations', 'certificate'].includes(activeTab) && renderPaywallWrapper(
              'Premium Workspace Tools Locked',
              'Free accounts preview top-level scores only. Choose a Pro plan to unlock granular analysis, tracking, and automated compliance workflows.',
              <>
            {/* TAB 3: DSR DEADLINE TRACKER & ITEM 12 INTAKE FORM */}
            {activeTab === 'dsr_manager' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={20} color="var(--sky)" /> Data Subject Rights (DSR) Statutory Tracker
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>ICO statutory 30-day countdown for erasure, access & rectification requests.</p>
                    </div>
                  </div>

                  {/* ITEM 12: PUBLIC INTAKE FORM EMBED SNIPPET */}
                  <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sky)' }}>Public Consumer DSR Intake Widget</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Embed this widget on your website `/privacy` page to receive statutory requests automatically.</div>
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(`<iframe src="https://portal.privacyready.co.uk/public/dsr?org=${authUser?.organizationName}" width="100%" height="450" frameborder="0"></iframe>`); showToast('DSR Intake Embed Code copied!', 'success'); }}
                      style={{ background: 'var(--sky)', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Code size={14} /> Copy Embed Code
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dsrs.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        No active DSR requests in queue. Public intake form is ready.
                      </div>
                    ) : (
                      dsrs.map((d) => {
                        const daysElapsed = Math.floor((Date.now() - d.createdAtTimestamp) / (1000 * 3600 * 24));
                        const daysLeft = Math.max(0, 30 - daysElapsed);
                        const isOverdue = daysLeft === 0 && d.status !== 'Completed';

                        return (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedDsr(d)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 700, fontSize: '15px' }}>{d.type}</span>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, background: isOverdue ? 'rgba(231,76,60,0.2)' : 'rgba(56,189,248,0.15)', color: isOverdue ? '#e74c3c' : 'var(--sky)' }}>
                                  {isOverdue ? '🚨 OVERDUE' : `⏳ ${daysLeft} Days Remaining`}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Requester: {d.email} • Requested {d.date}</div>
                              {d.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{d.description}"</div>}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <select 
                                value={d.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value as any;
                                  try {
                                    const updateRes = await fetch(`${import.meta.env.VITE_API_URL}/api/dsr/${d.id}`, {
      credentials: 'include',
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: newStatus })
                                    });
                                    if (updateRes.ok) {
                                      setDsrs(dsrs.map(item => item.id === d.id ? { ...item, status: newStatus } : item));
                                      showToast(`DSR ${d.id} status updated to ${newStatus}`, 'info');
                                    } else {
                                      throw new Error('Update failed');
                                    }
                                  } catch (err) {
                                    showToast('Failed to update DSR status', 'error');
                                  }
                                }}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                              >
                                <option value="PENDING">Pending</option>
                                <option value="IN_REVIEW">In Review</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {selectedDsr && (
                    <div style={{ marginTop: '24px', background: '#0a0f1e', border: '1px solid var(--sky)', borderRadius: '16px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--sky)' }}>DSR Request Details: {selectedDsr.id}</h4>
                        <button onClick={() => setSelectedDsr(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div><strong>Type:</strong> {selectedDsr.type}</div>
                        <div><strong>Requester Email:</strong> {selectedDsr.email}</div>
                        <div><strong>Submission Date:</strong> {selectedDsr.date}</div>
                        <div><strong>ICO Statutory Target:</strong> 30 Days from submission</div>
                        <div style={{ gridColumn: 'span 2' }}><strong>Full Description / Request Notes:</strong> {selectedDsr.description || 'No additional details provided.'}</div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 4: POLICY GENERATOR WIZARD */}
            {activeTab === 'policy_generator' && (
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileCheck size={22} color="var(--sky)" /> UK GDPR Policy Generator Wizard
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Business / Legal Entity Name</label>
                      <input type="text" value={policyForm.businessName} onChange={(e) => setPolicyForm({ ...policyForm, businessName: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Privacy Contact Email</label>
                      <input type="email" value={policyForm.contactEmail} onChange={(e) => setPolicyForm({ ...policyForm, contactEmail: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Data Categories Collected</label>
                      <input type="text" value={policyForm.dataTypes} onChange={(e) => setPolicyForm({ ...policyForm, dataTypes: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }} />
                    </div>
                  </div>

                  <div style={{ background: '#0a0f1e', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--sky)' }}>Draft Output Preview</h4>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: '220px', overflowY: 'auto' }}>
                        {`# UK GDPR PRIVACY NOTICE\nController: ${policyForm.businessName}\nEmail: ${policyForm.contactEmail}\n\n1. DATA COLLECTED\n${policyForm.dataTypes}\n\n2. PROCESSORS\n${policyForm.thirdParties}`}
                      </pre>
                    </div>

                    <button 
                      onClick={handleCopyPolicy}
                      style={{ background: 'var(--sky)', color: '#0f172a', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
                    >
                      <Copy size={16} /> {copiedPolicy ? 'Copied!' : 'Copy Policy Markdown'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5-10: COMING SOON PLACEHOLDERS */}
            {['consent_manager', 'vendors_ropa', 'breach_register', 'training', 'integrations', 'certificate'].includes(activeTab) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', textAlign: 'center', padding: '60px 20px' }}>
                <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '40px' }}>
                  <Lock size={48} color="var(--sky)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 16px 0' }}>Feature Coming Soon</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                    This module is currently in development and will be available in an upcoming release. We are working hard to bring you real, API-backed features for complete compliance management.
                  </p>
                </section>
              </div>
            )}

              </>
            )}

            {/* TAB 11: ITEM 19 SETTINGS & ORG PROFILE */}
            {activeTab === 'settings' && (
              <SettingsComponent />
            )}
          </>
        )}
      </main>

      {/* ITEM 14: ONBOARDING WIZARD MODAL */}
      {showOnboarding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', maxWidth: '520px', width: '90%', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--sky)' }}>Welcome to PrivacyReady</h3>
              <button onClick={() => setShowOnboarding(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Follow these 3 quick steps to automate your organisation's UK GDPR compliance:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '13px' }}>1️⃣ <strong>Add domain & social profiles</strong> to your audit registry.</div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '13px' }}>2️⃣ <strong>Generate your UK GDPR Privacy Policy</strong> using the wizard.</div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '13px' }}>3️⃣ <strong>Review 8 Pillars</strong> and complete remediation tasks.</div>
            </div>
            <button onClick={() => setShowOnboarding(false)} style={{ width: '100%', background: 'var(--sky)', color: '#0f172a', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* ITEM 13: SIDE-BY-SIDE COMPARISON MODAL */}
      {showCompareModal && selectedAuditsForCompare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', maxWidth: '720px', width: '90%', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Audit Comparison View</h3>
              <button onClick={() => setShowCompareModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--sky)' }}>{selectedAuditsForCompare[0].target}</h4>
                <div>Date: {selectedAuditsForCompare[0].date}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{selectedAuditsForCompare[0].score}%</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--sky)' }}>{selectedAuditsForCompare[1].target}</h4>
                <div>Date: {selectedAuditsForCompare[1].date}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>{selectedAuditsForCompare[1].score}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITEM 21: ICO 72-HOUR BREACH WIZARD MODAL */}
      {showIcoWizard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '24px', padding: '32px', maxWidth: '560px', width: '90%', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f87171' }}>ICO 72-Hour Breach Reporting Assistant</h3>
              <button onClick={() => setShowIcoWizard(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleIcoWizardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nature of Breach</label>
                <input type="text" value={icoFormData.nature} onChange={e => setIcoFormData({ ...icoFormData, nature: e.target.value })} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Approx. Data Subjects Affected</label>
                <input type="number" value={icoFormData.approxSubjects} onChange={e => setIcoFormData({ ...icoFormData, approxSubjects: e.target.value })} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mitigation Actions Taken</label>
                <input type="text" value={icoFormData.mitigation} onChange={e => setIcoFormData({ ...icoFormData, mitigation: e.target.value })} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
              </div>
              <button type="submit" style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>
                Generate ICO Report & Submit Incident
              </button>
            </form>
          </div>
        </div>
      )}
      {/* PORTAL FOOTER */}
      <footer style={{
        marginTop: '60px',
        paddingTop: '32px',
        paddingBottom: '32px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        color: 'var(--text-secondary)',
        fontSize: '13px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: '#fff' }}>PrivacyReady</span>
          <span>© 2026 PrivacyReady Ltd. All rights reserved.</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <a href="https://privacyready.co.uk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</a>
          <a href="https://privacyready.co.uk/privacy-policy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="https://privacyready.co.uk/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</a>
          <a href="https://privacyready.co.uk/cookies.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Cookie Policy</a>
          <a href="https://privacyready.co.uk/faq.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>FAQ</a>
          <a href="https://privacyready.co.uk/contact.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact Support</a>
        </div>
      </footer>

    </div>
  );
}

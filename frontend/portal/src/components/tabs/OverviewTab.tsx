import { Shield, TrendingUp, CheckSquare, ShieldCheck } from 'lucide-react';

export default function OverviewTab({
  get8Pillars,
  remediationTasks,
  handleToggleTask,
  hasSubscription,
  handleStripeCheckout
}: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="paywall-blur-container">
        <div className={!hasSubscription ? 'paywall-blurred-content' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={22} color="var(--sky)" />
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>8 Pillars of UK GDPR Compliance</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#27ae60', background: 'rgba(39, 174, 96, 0.15)', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                {get8Pillars().filter((p: any) => p.passed).length} of 8 Pillars Passing
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {get8Pillars().map((p: any, idx: number) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.title}</span>
                    {p.passed ? (
                      <span style={{ color: '#27ae60', background: 'rgba(39,174,96,0.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>PASS</span>
                    ) : (
                      <span style={{ color: 'var(--warning)', background: 'rgba(230,126,34,0.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>ATTENTION</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={22} color="var(--sky)" />
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Compliance Score Progression</h3>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Last 30 Days</span>
            </div>
            <div style={{ height: '140px', width: '100%', position: 'relative' }}>
              <svg viewBox="0 0 500 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <path d="M 0,90 Q 125,50 250,70 T 500,20" fill="none" stroke="var(--sky)" strokeWidth="4" />
                <path d="M 0,90 Q 125,50 250,70 T 500,20 L 500,120 L 0,120 Z" fill="url(#blue-gradient)" opacity="0.2" />
                <defs>
                  <linearGradient id="blue-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sky)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </section>

          {remediationTasks.length > 0 && (
            <section style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckSquare size={20} color="var(--sky)" /> Remediation Action Plan
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {remediationTasks.filter((t: any) => t.completed).length} of {remediationTasks.length} Completed
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {remediationTasks.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: t.completed ? 'rgba(39,174,96,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input type="checkbox" checked={t.completed} onChange={() => handleToggleTask(t.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--text-secondary)' : '#fff' }}>{t.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Asset: {t.auditTarget} — {t.details}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '8px', background: t.priority === 'Critical' ? 'rgba(231,76,60,0.2)' : 'rgba(230,126,34,0.2)', color: t.priority === 'Critical' ? '#e74c3c' : '#e67e22', fontWeight: 700 }}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {!hasSubscription && (
          <div className="paywall-overlay">
            <ShieldCheck size={52} color="var(--sky)" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>
              8-Pillars Compliance Breakdown Locked
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '520px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              Free accounts preview top-level scores only. Choose a Pro plan to unlock granular pillar analysis, evidence logs, and automated remediation tasks.
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => handleStripeCheckout('starter')}
                style={{
                  background: 'linear-gradient(135deg, var(--sky), #3b82f6)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(56, 189, 248, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                Starter Pro (£15/mo)
              </button>

              <button
                onClick={() => handleStripeCheckout('growth')}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Growth Plan (£39/mo)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

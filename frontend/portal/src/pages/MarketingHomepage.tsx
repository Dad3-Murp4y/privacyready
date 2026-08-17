import { ArrowRight, CheckCircle2, Cookie, FileSearch, LockKeyhole, SearchCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicScanner from './PublicScanner';
import { Card, StatusBadge } from '../components/ui';

const checks = [
  { icon: <LockKeyhole />, title: 'Transport security', copy: 'Review HTTPS and other website security signals exposed to visitors.' },
  { icon: <FileSearch />, title: 'Privacy information', copy: 'Look for accessible privacy information and common notice signals.' },
  { icon: <Cookie />, title: 'Cookies and tracking', copy: 'Identify cookie and third-party script indicators that may need review.' },
  { icon: <SearchCheck />, title: 'Data collection signals', copy: 'Surface forms and other website elements that may collect personal data.' },
];

const faqs = [
  { question: 'Does UK GDPR apply to small businesses?', answer: 'UK GDPR can apply to organisations of any size when they process personal data. What your business needs to do depends on its processing activities, risks and legal obligations.' },
  { question: 'What does the free website scan check?', answer: 'The automated scan reviews observable website privacy and security signals, including transport security, privacy information, cookies, scripts and data-collection indicators. It is a practical starting point, not legal advice or a compliance guarantee.' },
  { question: 'What happens after the free scan?', answer: 'You can create an account or sign in to claim the one-time scan and keep it in your organisation workspace. Paid plans add detailed operational tools and findings.' },
  { question: 'Is my organisation data kept separate?', answer: 'Yes. The application scopes organisation records on the server. Subscription checks and tenant access controls are not based solely on what the browser displays.' },
];

export default function MarketingHomepage() {
  return <div className="marketing-page">
    <nav className="marketing-nav" aria-label="Main navigation">
      <Link className="marketing-brand" to="/"><ShieldCheck size={25} /> PrivacyReady</Link>
      <div className="marketing-nav__links"><a href="#checks">What we check</a><a href="#pricing">Pricing</a><Link to="/login">Sign in</Link><a className="ui-button ui-button--primary" href="#scanner">Run free GDPR scan</a></div>
    </nav>

    <section className="marketing-hero">
      <div className="marketing-hero__inner">
        <div>
          <p className="eyebrow">Practical UK GDPR operations</p>
          <h1>Know your privacy posture. Act on what matters.</h1>
          <p className="marketing-hero__lead">PrivacyReady helps growing organisations find website privacy risks, prioritise compliance work, and keep a clear operational record.</p>
          <div className="public-scanner__actions"><a className="ui-button ui-button--primary" href="#scanner">Run free GDPR scan <ArrowRight size={17} /></a><a className="ui-button ui-button--secondary" href="#pricing">See pricing</a></div>
          <div className="marketing-proof"><span><CheckCircle2 size={15} /> Real server-side scanning</span><span><LockKeyhole size={15} /> Tenant-isolated workspace</span><span><ShieldCheck size={15} /> Security-first workflows</span></div>
        </div>
        <div id="scanner"><PublicScanner embedded /></div>
      </div>
    </section>

    <section className="business-strip" aria-label="Designed for growing organisations"><span>Built for practical privacy operations across</span><strong>Professional services</strong><strong>SaaS</strong><strong>Retail</strong><strong>Charities</strong><strong>Growing teams</strong></section>

    <section className="marketing-section preview-section">
      <div className="marketing-section__header"><p className="eyebrow">One focused workspace</p><h2>See what needs attention next</h2><p>The authenticated dashboard prioritises your real server-provided score, findings, actions and scan history. Areas without evidence remain clearly marked as not assessed.</p></div>
      <Card className="product-preview" aria-label="Illustration of the PrivacyReady workspace"><div className="product-preview__nav">PrivacyReady <span>Compliance workspace</span></div><div className="product-preview__body"><div><p className="eyebrow">Privacy readiness</p><h3>Your organisation score</h3><span className="preview-placeholder">Calculated from recorded scans</span></div><div><h3>Priority actions</h3><StatusBadge tone="warning">Needs review</StatusBadge><p>Actions appear when your scans return findings.</p></div><div><h3>Recent scans</h3><StatusBadge>Not assessed</StatusBadge><p>New organisations start with an honest empty state.</p></div></div></Card>
    </section>

    <section className="marketing-section marketing-section--soft" id="checks">
      <div className="marketing-section__header"><p className="eyebrow">What PrivacyReady checks</p><h2>Useful signals, clearly explained</h2><p>The live scanner highlights observable issues for review. It does not fabricate results or promise legal compliance.</p></div>
      <div className="check-grid">{checks.map((item) => <Card className="feature-card" key={item.title}>{item.icon}<h3>{item.title}</h3><p>{item.copy}</p></Card>)}</div>
    </section>

    <section className="marketing-section" id="how-it-works">
      <div className="marketing-section__header"><p className="eyebrow">Three straightforward steps</p><h2>From website signals to accountable action</h2></div>
      <ol className="steps-grid"><li><span>1</span><h3>Run a real scan</h3><p>Enter a public website address and let the protected scanner evaluate it.</p></li><li><span>2</span><h3>Claim your report</h3><p>Sign in or register, then securely associate the one-time scan with your organisation.</p></li><li><span>3</span><h3>Work through priorities</h3><p>Use the dashboard to review findings, scans and the next actions supported by your plan.</p></li></ol>
    </section>

    <section className="marketing-section marketing-section--soft" id="pricing">
      <div className="marketing-section__header"><p className="eyebrow">Simple staging plans</p><h2>Choose the workspace that fits your team</h2><p>Start with a free scan. Upgrade through the application when you need the operational workspace.</p></div>
      <div className="pricing-grid"><Card className="pricing-card"><p className="eyebrow">Founder</p><h3>£15 <small>/ month</small></h3><p>For small teams building a repeatable privacy workflow.</p><ul><li>Detailed findings</li><li>DSR management</li><li>Operational compliance tools</li></ul><a className="ui-button ui-button--primary" href="#scanner">Run free GDPR scan</a></Card><Card className="pricing-card"><p className="eyebrow">Growth</p><h3>£39 <small>/ month</small></h3><p>For growing organisations that need broader team workflows.</p><ul><li>Everything in Founder</li><li>Growth plan entitlements</li><li>Expanded operational capacity</li></ul><a className="ui-button ui-button--primary" href="#scanner">Run free GDPR scan</a></Card></div>
    </section>

    <section className="marketing-section" id="faq"><div className="marketing-section__header"><p className="eyebrow">Frequently asked questions</p><h2>Before you run your scan</h2></div><div className="faq-list">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>

    <section className="marketing-cta"><div className="marketing-cta__inner"><div><h2>Make privacy readiness easier to run.</h2><p>Start with a genuine website scan. No payment details required.</p></div><a className="ui-button ui-button--secondary" href="#scanner">Run free GDPR scan <ArrowRight size={17} /></a></div></section>
    <footer className="marketing-footer"><div className="marketing-footer__inner"><span>PrivacyReady · UK GDPR compliance operations</span><div><a href="https://privacyready.co.uk/privacy-policy.html">Privacy</a> · <a href="https://privacyready.co.uk/terms.html">Terms</a> · <a href="https://privacyready.co.uk/contact.html">Contact</a></div></div></footer>
  </div>;
}

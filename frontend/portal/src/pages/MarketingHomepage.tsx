import { ArrowRight, BriefcaseBusiness, CheckCircle2, Cookie, Eye, FileSearch, Hotel, LockKeyhole, Repeat2, SearchCheck, ShieldCheck, ShoppingCart, Stethoscope, Wrench } from 'lucide-react';
import PublicScanner from './PublicScanner';
import { Card, StatusBadge } from '../components/ui';
import PublicSiteLayout from '../components/layout/PublicSiteLayout';
import { PUBLIC_FAQS } from '../data/publicContent';

const checks = [
  { icon: <LockKeyhole />, title: 'Transport security', copy: 'Review HTTPS and other website security signals exposed to visitors.' },
  { icon: <FileSearch />, title: 'Privacy information', copy: 'Look for accessible privacy information and common notice signals.' },
  { icon: <Cookie />, title: 'Cookies and tracking', copy: 'Identify cookie and third-party script indicators that may need review.' },
  { icon: <SearchCheck />, title: 'Data collection signals', copy: 'Surface forms and other website elements that may collect personal data.' },
];

const journey = [
  { icon: <SearchCheck />, label: 'Find', title: 'Scan observable signals', copy: 'Assess a public website and identify potential privacy and security issues.' },
  { icon: <Eye />, label: 'Understand', title: 'Prioritise what matters', copy: 'Paid plans show detailed findings, severity, context and supporting evidence returned by the assessment.' },
  { icon: <Wrench />, label: 'Fix', title: 'Work through remediation', copy: 'Use available remediation guidance, or contact PrivacyReady when you need manual help.' },
  { icon: <CheckCircle2 />, label: 'Verify', title: 'Re-scan after changes', copy: 'Run another assessment to check whether previously detected website signals have changed.' },
  { icon: <Repeat2 />, label: 'Repeat', title: 'Check again over time', copy: 'Run assessments as your website changes. Automated monitoring and alerts are not currently available.' },
];

const sectors = [
  { icon: <Stethoscope />, title: 'Clinics and practices', copy: 'Review observable signals around booking forms, privacy information and third-party booking tools.' },
  { icon: <Hotel />, title: 'Hospitality and hotels', copy: 'Assess public reservation journeys, marketing technologies and booking-platform signals.' },
  { icon: <ShoppingCart />, title: 'E-commerce', copy: 'Surface website signals around checkout journeys, advertising technology, email marketing and third parties.' },
  { icon: <BriefcaseBusiness />, title: 'Professional services', copy: 'Review lead forms, newsletters, privacy information and third-party services visible on the website.' },
];

export default function MarketingHomepage() {
  return <PublicSiteLayout title="PrivacyReady | UK GDPR website privacy assessment" description="Assess observable website privacy signals, prioritise findings and organise practical remediation with PrivacyReady for UK SMEs." canonicalPath="/">
    <section className="marketing-hero">
      <div className="marketing-hero__inner">
        <div>
          <p className="eyebrow">Website privacy assessment for UK SMEs</p>
          <h1>Find privacy risks. Understand what matters. Take practical action.</h1>
          <p className="marketing-hero__lead">PrivacyReady assesses observable website signals, prioritises potential issues and supports practical remediation. Re-scan after changes to see whether detected signals have changed.</p>
          <div className="public-scanner__actions"><a className="ui-button ui-button--primary" href="#scanner">Run a free privacy scan <ArrowRight size={17} /></a><a className="ui-button ui-button--secondary" href="#journey">See how it works</a></div>
          <div className="marketing-proof"><span><CheckCircle2 size={15} /> Real server-side assessment</span><span><LockKeyhole size={15} /> Tenant-isolated workspace</span><span><ShieldCheck size={15} /> No compliance guarantee</span></div>
        </div>
        <div id="scanner"><PublicScanner embedded /></div>
      </div>
    </section>

    <section className="business-strip" aria-label="Designed for UK small and medium-sized organisations"><span>Practical privacy readiness for</span><strong>Clinics</strong><strong>Hospitality</strong><strong>E-commerce</strong><strong>Professional services</strong></section>

    <section className="marketing-section" id="journey">
      <div className="marketing-section__header"><p className="eyebrow">From assessment to action</p><h2>Find, understand, fix, verify and repeat</h2><p>A practical workflow for turning observable website signals into prioritised privacy work. It supports readiness and decision-making, not legal certification.</p></div>
      <ol className="lifecycle-grid">{journey.map((item, index) => <li key={item.label}><div className="lifecycle-grid__top"><span>{index + 1}</span>{item.icon}</div><p className="eyebrow">{item.label}</p><h3>{item.title}</h3><p>{item.copy}</p></li>)}</ol>
    </section>

    <section className="marketing-section marketing-section--soft preview-section">
      <div className="marketing-section__header"><p className="eyebrow">Understand and act</p><h2>Move from a summary to a privacy action plan</h2><p>The free assessment provides a score and risk summary. Paid plans unlock the detailed server-provided findings needed to understand and address what was detected.</p></div>
      <Card className="product-preview" aria-label="Illustration of the PrivacyReady workspace"><div className="product-preview__nav">PrivacyReady <span>Assessment workspace</span></div><div className="product-preview__body"><div><p className="eyebrow">Privacy readiness</p><h3>Assessment score</h3><span className="preview-placeholder">Calculated from recorded scans</span></div><div><h3>Prioritised findings</h3><StatusBadge tone="warning">Needs review</StatusBadge><p>Paid workspaces show the finding context returned by the scanner.</p></div><div><h3>Remediation</h3><StatusBadge>Action plan</StatusBadge><p>Work through available guidance, then run a repeat assessment.</p></div></div></Card>
    </section>

    <section className="marketing-section" id="checks">
      <div className="marketing-section__header"><p className="eyebrow">What PrivacyReady checks</p><h2>Observable website signals, clearly explained</h2><p>The assessment highlights potential issues for review. It cannot see every internal process and does not prove legal compliance.</p></div>
      <div className="check-grid">{checks.map((item) => <Card className="feature-card" key={item.title}>{item.icon}<h3>{item.title}</h3><p>{item.copy}</p></Card>)}</div>
    </section>

    <section className="marketing-section marketing-section--soft" id="sectors">
      <div className="marketing-section__header"><p className="eyebrow">Built for UK SMEs</p><h2>Start with the website journeys your customers use</h2><p>PrivacyReady assesses public website signals. It does not inspect private clinical systems, internal databases or offline processes.</p></div>
      <div className="sector-grid">{sectors.map((sector) => <Card className="feature-card" key={sector.title}>{sector.icon}<h3>{sector.title}</h3><p>{sector.copy}</p></Card>)}</div>
    </section>

    <section className="marketing-section" id="pricing">
      <div className="marketing-section__header"><p className="eyebrow">Straightforward plans</p><h2>Choose the workspace that fits your team</h2><p>Start with a free assessment. Upgrade when you need detailed findings, remediation guidance and operational tools.</p></div>
      <div className="pricing-grid"><Card className="pricing-card"><p className="eyebrow">Founder</p><h3>£15 <small>/ month</small></h3><p>For small teams building a repeatable privacy workflow.</p><ul><li>Detailed findings and evidence</li><li>Remediation guidance</li><li>DSR and policy tools</li><li>Repeat website assessments</li></ul><a className="ui-button ui-button--primary" href="#scanner">Run a free privacy scan</a></Card><Card className="pricing-card"><p className="eyebrow">Growth</p><h3>£39 <small>/ month</small></h3><p>For growing organisations choosing the Growth plan.</p><ul><li>Current PrivacyReady workspace</li><li>Detailed findings and evidence</li><li>Remediation guidance</li><li>DSR and policy tools</li></ul><a className="ui-button ui-button--primary" href="#scanner">Run a free privacy scan</a></Card></div>
      <p className="pricing-help">Need help with remediation? <a href="/contact">Contact us to discuss your requirements.</a></p>
    </section>

    <section className="marketing-section marketing-section--soft" id="agencies">
      <Card className="agency-callout"><div><p className="eyebrow">For agencies and service providers</p><h2>Assess client websites before handover</h2><p>Web agencies, freelance developers, IT service providers and digital agencies can use PrivacyReady assessments to help identify observable privacy issues. A reseller or partner programme is not currently available.</p></div><a className="ui-button ui-button--secondary" href="/contact">Discuss an agency use case <ArrowRight size={17} /></a></Card>
    </section>

    <section className="marketing-section" id="faq"><div className="marketing-section__header"><p className="eyebrow">Frequently asked questions</p><h2>Before you run your assessment</h2></div><div className="faq-list">{PUBLIC_FAQS.slice(0, 5).map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>

    <section className="marketing-cta"><div className="marketing-cta__inner"><div><h2>Turn website privacy signals into practical action.</h2><p>Start with a real assessment. No payment details required.</p></div><a className="ui-button ui-button--secondary" href="#scanner">Run a free privacy scan <ArrowRight size={17} /></a></div></section>
  </PublicSiteLayout>;
}

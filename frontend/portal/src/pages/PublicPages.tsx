import { Link, useLocation, useParams } from 'react-router-dom';
import PublicSiteLayout from '../components/layout/PublicSiteLayout';
import { PUBLIC_FAQS } from '../data/publicContent';

const pageProps = {
  about: {
    title: 'About PrivacyReady | UK GDPR readiness software',
    description: 'Learn how PrivacyReady helps UK SMEs identify website privacy risks and organise practical UK GDPR readiness work.',
    canonicalPath: '/about',
  },
  contact: {
    title: 'Contact PrivacyReady',
    description: 'Contact PrivacyReady about its UK GDPR readiness software and website scanning service.',
    canonicalPath: '/contact',
  },
  faq: {
    title: 'PrivacyReady FAQ | Website scans and UK GDPR',
    description: 'Answers about PrivacyReady website scans, UK GDPR for small businesses, plans, legal advice and data handling.',
    canonicalPath: '/faq',
  },
  guide: {
    title: 'UK GDPR guide for small businesses | PrivacyReady',
    description: 'A practical introduction to UK GDPR readiness for small organisations, including transparency, cookies and data rights.',
    canonicalPath: '/gdpr-guide',
  },
  privacy: {
    title: 'Privacy Policy | PrivacyReady',
    description: 'PrivacyReady privacy policy and information about how personal data is processed.',
    canonicalPath: '/privacy',
  },
  terms: {
    title: 'Terms of Service | PrivacyReady',
    description: 'The terms governing access to and use of the PrivacyReady service.',
    canonicalPath: '/terms',
  },
  cookies: {
    title: 'Cookies and browser storage | PrivacyReady',
    description: 'How PrivacyReady uses authentication cookies and necessary browser storage.',
    canonicalPath: '/cookies',
  },
} as const;

function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return <header className="public-page__header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="public-page__lead">{lead}</p></header>;
}

export function AboutPage() {
  return <PublicSiteLayout {...pageProps.about} mainClassName="public-page"><PageIntro eyebrow="About PrivacyReady" title="Practical privacy operations for growing organisations" lead="PrivacyReady is UK GDPR readiness and compliance software designed to help small and mid-sized organisations identify website risks and organise the work that follows." /><section><h2>Our purpose</h2><p>Privacy obligations apply to organisations of every size, but the work can be difficult to organise without specialist resources. PrivacyReady brings website scanning, findings and operational records into one focused workspace.</p><p>The software is intended to make privacy work easier to understand and manage. It does not provide legal advice, guarantee compliance or replace advice from a qualified professional.</p></section><section><h2>How the platform helps</h2><div className="public-card-grid"><article><h3>Observable website signals</h3><p>Scan public web pages for transport security, privacy information, cookies, scripts and data-collection indicators that may require review.</p></article><article><h3>Clear priorities</h3><p>Turn supported scan findings into understandable actions without inventing evidence or hiding uncertainty.</p></article><article><h3>Operational records</h3><p>Keep scans and available compliance workflows associated with the correct organisation workspace.</p></article></div></section><section><h2>Company information</h2><p>PrivacyReady Ltd (Reg No. 14592031) is registered in England &amp; Wales.</p><p>Questions? <Link to="/contact">Contact PrivacyReady</Link>.</p></section></PublicSiteLayout>;
}

export function ContactPage() {
  return <PublicSiteLayout {...pageProps.contact} mainClassName="public-page"><PageIntro eyebrow="Contact" title="Get in touch" lead="Questions about PrivacyReady, website scanning or your account can be sent by email." /><section className="public-contact-card"><h2>Email PrivacyReady</h2><p><a href="mailto:hello@privacyready.co.uk">hello@privacyready.co.uk</a></p><p>Please do not send passwords, authentication tokens or other secrets by email.</p></section><section><h2>Company information</h2><p>PrivacyReady Ltd (Reg No. 14592031), registered in England &amp; Wales.</p></section></PublicSiteLayout>;
}

export function FaqPage() {
  return <PublicSiteLayout {...pageProps.faq} mainClassName="public-page"><PageIntro eyebrow="Resources" title="Frequently asked questions" lead="Straightforward answers about PrivacyReady and its website scanning and compliance operations software." /><div className="public-faq-list">{PUBLIC_FAQS.map((faq) => <section key={faq.question}><h2>{faq.question}</h2><p>{faq.answer}</p></section>)}</div><section><h2>Still have a question?</h2><p>Email <a href="mailto:hello@privacyready.co.uk">hello@privacyready.co.uk</a>.</p></section></PublicSiteLayout>;
}

export function GdprGuidePage() {
  return <PublicSiteLayout {...pageProps.guide} mainClassName="public-page"><PageIntro eyebrow="UK GDPR guide" title="A practical starting point for small organisations" lead="UK GDPR readiness begins with understanding what personal data you use, why you use it and how people can exercise their rights." /><section><h2>Know your data and purpose</h2><p>Document the personal data your organisation collects, where it comes from, who can access it, how long it is kept and the lawful basis relied upon. The right approach depends on your actual processing and risk.</p></section><section><h2>Make privacy information easy to find</h2><p>People should be able to understand who is responsible for their data, how it is used, who it is shared with and how to exercise their rights. Keep public notices accurate when products or suppliers change.</p></section><section><h2>Review cookies and website collection</h2><p>Identify cookies, third-party scripts and forms on public websites. Optional technologies may require a valid choice before they run. A scan can surface observable signals, but it cannot determine every legal obligation.</p></section><section><h2>Prepare for individual rights and incidents</h2><p>Define how the organisation will recognise and handle data-rights requests, corrections, deletion requests and suspected personal-data breaches. Assign owners and preserve an appropriate record of decisions.</p></section><aside className="public-note"><strong>This guide is not legal advice.</strong> PrivacyReady provides software and general operational information. Obtain qualified advice for your organisation’s circumstances.</aside></PublicSiteLayout>;
}

export function PrivacyPage() {
  return <PublicSiteLayout {...pageProps.privacy} mainClassName="public-page public-page--legal"><PageIntro eyebrow="Legal" title="Privacy Policy" lead="Last Updated: August 4, 2026" /><section><h2>1. Introduction</h2><p>This policy sets out the basis on which any personal data we collect from you, or that you provide to us, will be processed by PrivacyReady. Please read the following carefully to understand our views and practices regarding your personal data.</p></section><section><h2>2. Information We Collect</h2><p>We collect information that you provide directly to us when you register for an account, such as your name, email address, and organisation details. We also automatically collect certain information when you visit our site, such as your IP address, browser type, and usage data.</p></section><section><h2>3. How We Use Your Information</h2><p>We use information held about you to carry out our obligations arising from any contracts entered into between you and us and to provide you with the information, products and services that you request from us.</p></section><section><h2>4. Information Sharing and Disclosure</h2><p>We do not sell your personal data. We may share your information with third-party service providers (such as hosting providers and payment processors) who perform services on our behalf and are bound by confidentiality obligations.</p></section><section><h2>5. Data Security</h2><p>We implement reasonable security measures to protect the security of your personal information. However, please be aware that no method of transmission over the internet or method of electronic storage is 100% secure.</p></section><section><h2>6. Your Data Protection Rights</h2><p>Under the UK GDPR, you have the right to access, rectify, or erase your personal data, restrict or object to our processing of your data, and the right to data portability. For privacy enquiries or to exercise your data protection rights, contact us at <a href="mailto:hello@privacyready.co.uk">hello@privacyready.co.uk</a> or write to us at PrivacyReady Ltd, 128 City Road, London, EC1V 2NX, UK.</p></section></PublicSiteLayout>;
}

export function TermsPage() {
  return <PublicSiteLayout {...pageProps.terms} mainClassName="public-page public-page--legal"><PageIntro eyebrow="Legal" title="Terms of Service" lead="Last Updated: August 4, 2026" /><section><h2>1. Acceptance of Terms</h2><p>By accessing and using PrivacyReady (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p></section><section><h2>2. Not Legal Advice</h2><p><strong>PrivacyReady provides software tools for managing data privacy compliance. We are not a law firm. The information, automated scans, policy generators, and recommendations provided by our Service do not constitute legal advice.</strong></p><p>While we strive to ensure our tools align with UK GDPR requirements, you are solely responsible for your organisation's legal compliance. We strongly recommend consulting with a qualified solicitor for specific legal guidance.</p></section><section><h2>3. Use of the Service</h2><p>You must provide accurate information when registering for an account. You are responsible for maintaining the security of your account and password.</p></section><section><h2>4. Data Processing</h2><p>Where PrivacyReady processes personal data on an organisation's behalf, appropriate data-processing terms may be required. Use of the Service does not by itself establish that a separate Data Processing Agreement has been executed.</p></section><section><h2>5. Limitation of Liability</h2><p><strong>To the maximum extent permitted by law, PrivacyReady Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any regulatory fines (including ICO penalties), loss of profits, or data breaches resulting from your use of the Service.</strong></p><p>In no event shall our aggregate liability exceed the amount you paid us in the twelve (12) months preceding the claim.</p></section><section><h2>6. Modifications to the Service and Prices</h2><p>We reserve the right to modify or discontinue the Service (or any part thereof) without notice at any time. Prices of all Services are subject to change upon 30 days notice from us.</p></section></PublicSiteLayout>;
}

export function CookiesPage() {
  return <PublicSiteLayout {...pageProps.cookies} mainClassName="public-page public-page--legal"><PageIntro eyebrow="Legal" title="Cookies and browser storage" lead="This page describes the cookies and browser storage used by the current PrivacyReady application." /><section><h2>1. Authentication cookie</h2><p>When you sign in, PrivacyReady sets the <code>__Host-token</code> cookie to authenticate your session. It is HttpOnly, uses SameSite=Lax, is marked Secure in production and expires after one hour. It is necessary for signed-in portal functionality.</p></section><section><h2>2. Browser storage</h2><p>The public scan journey uses same-tab session storage for a scan identifier, one-time claim token, target and score while you move between the scanner, registration and sign-in. Legacy persistent copies from earlier versions are removed when registration opens. These values are not analytics cookies.</p></section><section><h2>3. Analytics and advertising</h2><p>PrivacyReady does not currently load optional analytics, advertising or behavioural-tracking technology in the portal. There is therefore no analytics consent preference to manage in the current application.</p></section><section><h2>4. Clearing stored data</h2><p>You can clear cookies and site data using your browser controls. Signing out clears the authentication cookie and also expires the legacy <code>auth_payload</code> cookie if an older version of the application set it.</p></section></PublicSiteLayout>;
}

const comingSoonFeatures = new Map([
  ['api-access', 'API Access'],
  ['compliance-monitoring', 'Compliance Monitoring'],
  ['webinars', 'Webinars'],
]);

export function ComingSoonPage() {
  const { feature } = useParams();
  const location = useLocation();
  const legacyFeature = new URLSearchParams(location.search).get('f')?.toLowerCase().replaceAll(' ', '-');
  const key = feature ?? legacyFeature ?? '';
  const name = comingSoonFeatures.get(key) ?? 'This feature';
  return <PublicSiteLayout title={`${name} coming soon | PrivacyReady`} description={`${name} is not currently available in PrivacyReady.`} canonicalPath={`/coming-soon/${key || 'feature'}`} mainClassName="public-page public-page--compact"><PageIntro eyebrow="Coming Soon" title={`${name} is not currently available`} lead="We are not presenting an unfinished capability as a working product. This page will be updated when the feature has a supported release." /><p>For questions about current PrivacyReady capabilities, <Link to="/contact">contact us</Link> or return to the <Link to="/">homepage</Link>.</p></PublicSiteLayout>;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: Array<{
    type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote';
    text: string | string[];
  }>;
  category: 'Product Update' | 'Compliance Guide' | 'Security';
  publishedAt: string;
  author: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  readTime: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    slug: 'navigating-gdpr-cookie-consent-rules-2026',
    title: 'Navigating GDPR Cookie Consent Rules in 2026',
    summary: 'The legal landscape of tracking cookies is shifting. Learn how modern privacy regulators define active consent, and how to stay compliant with zero friction.',
    category: 'Compliance Guide',
    publishedAt: 'July 8, 2026',
    author: {
      name: 'Sarah Jenkins',
      role: 'Head of Privacy & Compliance',
    },
    readTime: '5 min read',
    content: [
      {
        type: 'paragraph',
        text: 'Data privacy and tracking cookies remain a critical battleground for consumer trust and compliance. Regulators across Europe and the UK have significantly stepped up their enforcement actions against non-compliant "cookie banners." To ensure your organisation is compliant in 2026, it is essential to understand what constitutes true legal consent.'
      },
      {
        type: 'heading',
        text: 'The Five Pillars of Valid Consent'
      },
      {
        type: 'paragraph',
        text: 'Under current GDPR standards, consent is not just a checkbox. It must satisfy five distinct criteria:'
      },
      {
        type: 'list',
        text: [
          'Freely Given: Users must have a genuine choice. You cannot block access to your services or content just because a user declines non-essential cookies.',
          'Specific: You must obtain separate consent for separate purposes (e.g., analytics cookies vs. marketing/retargeting cookies).',
          'Informed: The banner must clearly explain who is tracking the user, what data is collected, and how it is used.',
          'Unambiguous: Consent requires a clear affirmative action. Implied consent—such as "by continuing to browse, you accept cookies"—is completely illegal.',
          'Easy to Withdraw: Users must be able to change their minds and revoke consent at any time, as easily as they gave it.'
        ]
      },
      {
        type: 'heading',
        text: 'The "Reject All" Equivalence Rule'
      },
      {
        type: 'paragraph',
        text: 'One of the most common compliance failures we scan for is the design of the banner buttons. Dark patterns—such as making the "Accept All" button prominent and bright while hiding "Reject All" inside a settings sub-menu—are now heavily penalized. Your "Reject All" button must be just as visible, styled equally, and accessible with a single click as the accept button.'
      },
      {
        type: 'quote',
        text: '"A user should not have to perform multiple clicks to protect their privacy if they can bypass it with one click. Choice architecture must be symmetrical."'
      },
      {
        type: 'heading',
        text: 'Actionable Steps to Compliance'
      },
      {
        type: 'paragraph',
        text: 'To audit and improve your posture today, follow this simple checklist:'
      },
      {
        type: 'list',
        text: [
          'Verify that all tracking scripts (Google Analytics, Meta Pixel, Hotjar, etc.) are blocked BEFORE the user clicks "Accept".',
          'Ensure your cookie banner is responsive and has clear, non-manipulative button layouts.',
          'Implement a persistent privacy badge or widget (like the PrivacyReady widget) that lets users reopen consent preferences at any time.'
        ]
      },
      {
        type: 'paragraph',
        text: 'At PrivacyReady, we automatically scan and detect these issues on your digital properties so you can address compliance gaps before regulators do.'
      }
    ]
  },
  {
    id: '2',
    slug: 'automating-data-subject-requests-dsr',
    title: 'How to Automate Data Subject Requests (DSR) Safely',
    summary: 'Handling manual GDPR right-to-know and erasure requests is a significant administrative bottleneck. Discover how automated workflows securely verify and fulfill DSRs.',
    category: 'Product Update',
    publishedAt: 'June 24, 2026',
    author: {
      name: 'David Kross',
      role: 'Lead Architect',
    },
    readTime: '4 min read',
    content: [
      {
        type: 'paragraph',
        text: 'Under GDPR Article 15 (Right of Access) and Article 17 (Right to Erasure), individuals have the power to request a copy of their data or ask for its permanent deletion. Historically, processing these requests was a highly manual, error-prone effort involving multiple engineering, legal, and support teams. In 2026, manual processing is no longer viable at scale.'
      },
      {
        type: 'heading',
        text: 'The Operational Cost of Manual DSRs'
      },
      {
        type: 'paragraph',
        text: 'A typical manual Data Subject Request (DSR) consumes approximately 10-15 engineering hours. Teams have to scour logs, search production databases, clear caches, and filter through customer support records—all while verifying that no other user\'s private data is accidentally leaked in the export. This manual coordination often risks exceeding the strict 30-day regulatory response window.'
      },
      {
        type: 'heading',
        text: 'The PrivacyReady DSR Solution'
      },
      {
        type: 'paragraph',
        text: 'We are thrilled to highlight our built-in DSR Manager. Designed to operate safely with minimal configuration, the system automates the verification and lookup phases:'
      },
      {
        type: 'list',
        text: [
          'Secure Authentication: Users submitting a request are securely verified via email OTP or OAuth, preventing malicious "identity theft" deletion requests.',
          'Automated Database Mapping: Once authorized, our API routes connect to your customer tables to securely generate a formatted JSON export of the user\'s data.',
          'Safe Deletion Handshakes: For deletion requests, a cascading sequence cleanly deletes or anonymizes user tables without breaking foreign key constraints or historic analytical aggregates.'
        ]
      },
      {
        type: 'heading',
        text: 'Security Best Practices for Automated DSRs'
      },
      {
        type: 'paragraph',
        text: 'When setting up automated DSR workflows, keep these three rules in mind:'
      },
      {
        type: 'list',
        text: [
          'Encrypt all DSR outputs: Exported archives must be password-protected or served over short-lived secure download links.',
          'Keep an audit log: Document the receipt, processing state, and completion date of every request. (PrivacyReady does this automatically in your admin dashboard).',
          'Exempt active legal files: Ensure your deletion routines preserve data required for tax, compliance, or fraud prevention.'
        ]
      },
      {
        type: 'paragraph',
        text: 'Automating your DSRs reduces legal risks, guarantees SLA compliance, and saves your engineering team hundreds of hours of manual database query extraction.'
      }
    ]
  },
  {
    id: '3',
    slug: 'securing-web-apps-against-third-party-leaks',
    title: 'Securing Web Applications Against Third-Party Script Leaks',
    summary: 'Third-party scripts account for over 70% of client-side security vulnerabilities. Learn how Content Security Policies (CSP) and active scanning protect user data.',
    category: 'Security',
    publishedAt: 'May 15, 2026',
    author: {
      name: 'Marcus Vance',
      role: 'Principal Security Researcher',
    },
    readTime: '6 min read',
    content: [
      {
        type: 'paragraph',
        text: 'Modern web applications are highly collaborative, pulling scripts for tracking, customer chat, fonts, and stylesheets from dozens of external domains. However, once a third-party script is executed in your user\'s browser, it inherits full access to the Document Object Model (DOM). This creates a substantial risk of client-side data exfiltration, formjacking, and cross-site scripting (XSS).'
      },
      {
        type: 'heading',
        text: 'The Anatomy of a Client-Side Data Leak'
      },
      {
        type: 'paragraph',
        text: 'When a user fills out a registration form or enters payment details, a compromised or overly intrusive third-party script can bind event listeners to input fields. It can capture keystrokes and silently transmit personal data to unauthorized servers. Since these leaks occur entirely in the user\'s browser, traditional backend firewalls and API logs fail to detect them.'
      },
      {
        type: 'heading',
        text: 'Mitigation 1: Implement a Strict Content Security Policy (CSP)'
      },
      {
        type: 'paragraph',
        text: 'A Content Security Policy is a powerful browser-level defense. By declaring which domains are allowed to load and execute scripts, you prevent unauthorized code from running. Here is a strong baseline CSP header configuration:'
      },
      {
        type: 'code',
        text: `Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted-cdn.com; connect-src 'self' ${import.meta.env.VITE_API_URL}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;`
      },
      {
        type: 'paragraph',
        text: 'By enforcing a policy like this, even if a bad actor injects an external `<script src="https://malicious-domain.com/spy.js">` tag, the browser will refuse to load or run it.'
      },
      {
        type: 'heading',
        text: 'Mitigation 2: Continuous Client-Side Scanning'
      },
      {
        type: 'paragraph',
        text: 'While a CSP protects you from unknown domains, it doesn\'t prevent a legitimate, trusted domain from being compromised (supply chain attacks). That is why continuous automated scanning is vital. PrivacyReady\'s active scanner crawls your web portals, analyzes executing JavaScript files, identifies scripts collecting sensitive data, and warns you immediately if a trusted script begins communicating with a suspicious, unlisted endpoint.'
      },
      {
        type: 'paragraph',
        text: 'By combining a strict, actively managed Content Security Policy with PrivacyReady continuous compliance audits, you close the gap on client-side vulnerabilities and safeguard your customers\' personal data.'
      }
    ]
  }
];

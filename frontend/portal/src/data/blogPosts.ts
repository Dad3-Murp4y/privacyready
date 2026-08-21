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
    title: 'Navigating GDPR cookie consent rules in 2026',
    summary: 'A practical overview of active consent and the website signals organisations should review when using tracking technologies.',
    category: 'Compliance Guide',
    publishedAt: '8 July 2026',
    author: {
      name: 'PrivacyReady team',
      role: 'Editorial team'
},
    readTime: '5 min read',
    content: [
      {
        type: 'paragraph',
        text: 'Data privacy and tracking cookies remain important considerations for customer trust and compliance. Organisations using non-essential cookies should understand what constitutes valid consent and review their implementation against current regulatory guidance.'
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
          'Unambiguous: Consent requires a clear affirmative action. Implied consent, such as "by continuing to browse, you accept cookies", does not provide a valid affirmative choice.',
          'Easy to Withdraw: Users must be able to change their minds and revoke consent at any time, as easily as they gave it.'
        ]
      },
      {
        type: 'heading',
        text: 'The "Reject All" Equivalence Rule'
      },
      {
        type: 'paragraph',
        text: 'One website signal worth reviewing is the design of consent-banner controls. Dark patterns, such as making the "Accept all" button prominent while hiding "Reject all" inside a settings submenu, can undermine a valid choice. Rejecting optional cookies should be as straightforward as accepting them.'
      },
      {
        type: 'quote',
        text: '"A user should not have to perform multiple clicks to protect their privacy if they can bypass it with one click. Choice architecture must be symmetrical."'
      },
      {
        type: 'heading',
        text: 'Practical review steps'
      },
      {
        type: 'paragraph',
        text: 'To audit and improve your posture today, follow this simple checklist:'
      },
      {
        type: 'list',
        text: [
          'Verify that optional tracking scripts, such as analytics or advertising tools, do not run before the user gives the required consent.',
          'Ensure your cookie banner is responsive and has clear, non-manipulative button layouts.',
          'Provide a persistent, accessible control that lets users revisit their consent preferences at any time.'
        ]
      },
      {
        type: 'paragraph',
        text: 'PrivacyReady scans observable website signals, including cookies and third-party script indicators, to help organisations identify areas that need further review. A scan is not legal advice and does not certify compliance.'
      }
    ]
  },
  {
    id: '2',
    slug: 'automating-data-subject-requests-dsr',
    title: 'How to manage data subject requests safely',
    summary: 'Practical considerations for receiving, assigning and recording data subject requests without overstating what software can automate.',
    category: 'Product Update',
    publishedAt: '24 June 2026',
    author: {
      name: 'PrivacyReady team',
      role: 'Editorial team'
},
    readTime: '4 min read',
    content: [
      {
        type: 'paragraph',
        text: 'Under UK GDPR, individuals may exercise rights including access to personal data and, in relevant circumstances, erasure. Handling these requests can require coordination across operational, technical and legal teams. Software can support the workflow, but the organisation remains responsible for identity checks, decisions and responses.'
      },
      {
        type: 'heading',
        text: 'The Operational Cost of Manual DSRs'
      },
      {
        type: 'paragraph',
        text: 'A data subject request can require teams to search relevant systems, review records and protect other people\'s personal data while preparing a response. Clear ownership and an auditable workflow help organisations manage the applicable response period without assuming that every request follows the same process.'
      },
      {
        type: 'heading',
        text: 'A practical DSR workflow'
      },
      {
        type: 'paragraph',
        text: 'A useful request-management workflow should support the organisation without pretending to make legal decisions or perform unsupported data operations. Consider the following controls:'
      },
      {
        type: 'list',
        text: [
          'Identity checks: Define a proportionate method for confirming the requester\'s identity before disclosing or changing personal data.',
          'Request records: Record the request type, owner, status, relevant dates and decisions in an organisation-controlled workflow.',
          'Reviewed fulfilment: Search, export, correct or erase data only through approved systems and processes, with appropriate checks for exemptions and other people\'s rights.'
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
          'Keep an audit log: Document the receipt, processing state, decisions and completion date of every request.',
          'Exempt active legal files: Ensure your deletion routines preserve data required for tax, compliance, or fraud prevention.'
        ]
      },
      {
        type: 'paragraph',
        text: 'A structured workflow can reduce avoidable administrative effort and make deadlines easier to monitor. It does not guarantee compliance, determine whether an exemption applies or replace qualified advice.'
      }
    ]
  },
  {
    id: '3',
    slug: 'securing-web-apps-against-third-party-leaks',
    title: 'Securing web applications against third-party script leaks',
    summary: 'Learn how Content Security Policy and website scanning can help teams review risks introduced by third-party scripts.',
    category: 'Security',
    publishedAt: '15 May 2026',
    author: {
      name: 'PrivacyReady team',
      role: 'Editorial team'
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
        text: 'When a user fills out a registration form or enters payment details, a compromised or overly intrusive third-party script can bind event listeners to input fields. It can capture keystrokes and silently transmit personal data to unauthorised servers. Since these leaks occur entirely in the user\'s browser, traditional backend firewalls and API logs may not detect them.'
      },
      {
        type: 'heading',
        text: 'Mitigation 1: Implement a Strict Content Security Policy (CSP)'
      },
      {
        type: 'paragraph',
        text: 'A Content Security Policy is an important browser-level defence. By declaring which domains are allowed to load and execute scripts, it can help prevent unauthorised code from running. The following example illustrates the structure of a restrictive policy and must be adapted to the application it protects:'
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
        text: 'A CSP does not eliminate the risk that a legitimate, trusted domain could be compromised in a supply-chain attack. PrivacyReady can surface observable third-party script indicators during a website scan so that teams can decide what requires further investigation. It does not provide continuous runtime monitoring or certify that scripts are safe.'
      },
      {
        type: 'paragraph',
        text: 'A maintained Content Security Policy, supplier review and periodic website scanning can form part of a wider approach to reducing client-side risk. Each control has limits and should be reviewed in the context of the organisation\'s actual systems.'
      }
    ]
  }
];

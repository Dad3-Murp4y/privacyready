# PRD — Product Requirements Document

> PrivacyReady · UK GDPR compliance platform for SMEs

---

## Idea overview

PrivacyReady helps UK small and mid-sized businesses become (and stay) GDPR-compliant without hiring a full-time Data Protection Officer or paying enterprise compliance software prices.

UK SMEs face ICO enforcement under the Data Protection Act 2018 / UK GDPR, but lack legal and technical expertise to self-audit websites, social profiles, cookies, and data-subject workflows. PrivacyReady closes that gap with automated scanning, remediation guidance, and operational compliance tooling — all hosted in AWS `eu-west-2` (London) for UK data residency.

**Not in scope:** Thailand PDPA / DataWai (separate product, separate AWS account). This product is UK-only.

---

## What you're building

A two-surface product:

1. **Marketing site** (`privacyready.co.uk`) — static HTML/CSS/JS with a free instant GDPR scanner widget, pricing, FAQ, and legal pages.
2. **Client portal** (`portal.privacyready.co.uk`) — React SPA for authenticated orgs to run deep audits, manage DSRs, generate policies, track breaches/vendors/training, and manage team seats.

Backend microservices on AWS ECS Fargate (Core API, Scanner, DSR scaffold) behind an ALB, with Stripe billing, SES email, Redis queues, and an optional n8n + Bedrock compliance copilot.

---

## Core features

### Free surface (no account required)
- Instant website GDPR preview scan (~15s)
- High-level compliance score + top risk gaps
- SSL / security header checks
- Optional social / GA4 / Mailchimp identifiers on the landing widget
- Claim anonymous scan results onto an org at registration (claim-token flow)

### Auth & org management
- Email/password registration with SES verification (24h token)
- Login / logout / forgot-password / reset-password / forced password change
- Organization-scoped multi-user accounts (`MEMBER`, `ADMIN`, `SUPERADMIN`)
- Org-level team invite (temp password + verification email)
- Platform admin console for SUPERADMIN (users, orgs, role promotion)

### Compliance audits
- Authenticated deep scans (Website, Facebook, Instagram, LinkedIn, TikTok, WhatsApp, Mailchimp, Google Analytics 4)
- Score, risk level, findings JSON, remediation task list
- Past audits history with delete

### Operational GDPR tooling (portal tabs)
| Tab | Purpose |
|-----|---------|
| Overview | Score, metrics, remediation queue |
| Past Audits | Scan history |
| DSR Manager | ACCESS / ERASURE / RECTIFICATION / PORTABILITY / RESTRICTION with due dates |
| Policy Generator | Privacy & Cookie policy drafts |
| Consent Manager | Consent banner module (Growth+) |
| Vendors & RoPA | Processor register + records of processing |
| Breach Register | Article 33 ICO-oriented incident log |
| Staff Training | GDPR training tracker |
| Integrations | Webhooks / API (roadmap) |
| Certificate | Verified compliance badge |
| Settings | Account / org settings |

### Billing
| Plan | Price (founding) | Highlights |
|------|------------------|------------|
| Free Audit | £0 | Instant scan, top-3 gaps |
| Starter Pro | £15/mo (was £29) | Full findings, policies, DSR, breach register, certificate |
| Growth | £39/mo (was £79) | Consent banner, vendor register, training, 5 seats, priority support |

Stripe Checkout + webhooks drive `subscriptionStatus` on the Organization (`free` / `active` / `past_due` / `canceled`). Free-tier portal content is paywalled/blurred until premium.

---

## Target users

- Sole traders and micro businesses (Starter Pro)
- SMEs with ~10–50 staff (Growth)
- Platform operator (SUPERADMIN)

## Success criteria

- Free scan → register → claim scan works end-to-end
- Verified users can run authenticated scans and manage DSRs against Postgres
- Paid orgs unlock unblurred findings and premium modules
- All customer data stays in `eu-west-2` with encryption in transit and at rest

## Out of scope (current)

- Full standalone consent microservice (logic still in Core API; `services/consent` reserved)
- Production-ready Python DSR microservice (scaffold only; Node API owns persistence)
- Solicitor-reviewed legal copy (privacy/terms marked draft)
- Non-UK jurisdictions

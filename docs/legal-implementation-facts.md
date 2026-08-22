# PrivacyReady legal and privacy implementation facts

## Status and method

This is a technical fact record, not legal advice and not a final legal document. It records repository evidence at `origin/main` commit `91ec6c51813be488826132abac875114cc66e6f5`, inspected on 22 August 2026, plus the uncommitted bounded remediation described below. Where the repository does not establish a fact, this report says **BUSINESS CONFIRMATION REQUIRED** or **LEGAL REVIEW REQUIRED**.

The checked-out commit had the same Git tree as that authoritative main commit. No production system, AWS account, provider console or production data was accessed. Repository configuration proves intended or configured behaviour, not that every provider-side setting is currently effective.

### Principal files reviewed

- `AGENTS.md`, `README.md`, `SECURITY.md`, `rebuild-aws.sh`
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/RETENTION.md`
- `services/api/prisma/schema.prisma`, the initial migration, and `20260822000000_add_organization_deletion_request/migration.sql`
- `services/api/src/main.ts`, `email.ts`, `entitlement.ts`, `retention.ts`, `safe-logging.ts`, `plugins/security.ts`, `scripts/run-retention.ts`
- API account, admin, authentication, billing, consent, DSR, policy, scan and team routes, together with their unit and PostgreSQL integration tests
- `services/scanner/cmd/scanner/main.py`, `website_scanner.py`, the active social scanner modules, and scanner security tests
- `frontend/portal/index.html`, `src/App.tsx`, authentication context, public layout/content, public legal pages, scanner, registration, login, DSR, settings, team, policy, scan and operational workspace pages
- Staging Terraform roots and modules for providers, networking, ECS/Fargate, RDS, S3/CloudFront, Route 53, ACM, WAF, SES, Secrets Manager, ECR and observability

## 1. Company and contact facts

| Fact | Repository evidence | Assessment |
| --- | --- | --- |
| Public company name | `PrivacyReady Ltd` in `frontend/portal/src/pages/PublicPages.tsx` and `components/layout/PublicSiteLayout.tsx` | Public claim only; **BUSINESS CONFIRMATION REQUIRED** against Companies House records. |
| Company number | `14592031` in the same files | Public claim only; **BUSINESS CONFIRMATION REQUIRED**. |
| Jurisdiction | “Registered in England & Wales” in the same files | Public claim only; **BUSINESS CONFIRMATION REQUIRED**. |
| Postal address | `PrivacyReady Ltd, 128 City Road, London, EC1V 2NX, UK` appears only in the Privacy Policy in `PublicPages.tsx` | Whether this is the registered office and appropriate rights-contact address is **BUSINESS CONFIRMATION REQUIRED**. |
| General, support and privacy contact | `hello@privacyready.co.uk` is used on Contact, FAQ, Login support guidance and the Privacy Policy | One mailbox is presented for all three purposes. Ownership, response process and provider are **BUSINESS CONFIRMATION REQUIRED**. |
| Operational mailboxes | `support@privacyready.co.uk`, `demo@privacyready.co.uk` and staff addresses are described as hosted by Names.co.uk in `docs/DEPLOYMENT.md`; `support@` is only a proposed SES Reply-To | The public site does not present `support@`. Mailbox operation and retention are **BUSINESS CONFIRMATION REQUIRED**. |
| Billing contact | No billing-specific contact found | **BUSINESS CONFIRMATION REQUIRED**. |
| DPO | No current customer-facing claim that a DPO is appointed. Historical material in `docs/six-docs-before-ai/01-PRD.md` mentions avoiding the cost of a full-time DPO, not an appointment. | Formal appointment and contact details are **BUSINESS CONFIRMATION REQUIRED**. |
| ICO registration/reference | None found | **BUSINESS CONFIRMATION REQUIRED**. |

There is no backend contact form. The active Contact page supplies a `mailto:` link and warns against emailing secrets.

## 2. Personal-data inventory

| Data/category | Source and evident purpose | Store and retention | Application access | Control context |
| --- | --- | --- | --- | --- |
| Name, email, password | Account registrant; create and authenticate an account | PostgreSQL `User`: full name, unique email and bcrypt hash. Retained with an active organisation; cascades on organisation deletion. Individual users can also be removed by an organisation admin or platform superadmin. | The user through `/auth/me`; same-tenant admins through Team; platform `SUPERADMIN` through Admin | Service-controlled account administration, with customer-supplied values |
| Organisation name and optional industry | Registrant/admin; identify tenant/workspace | PostgreSQL `Organization`; retained until eligible organisation deletion | Members of the organisation indirectly; platform `SUPERADMIN`; public DSR performs an exact-name lookup | Customer-controlled tenant data; service-controlled tenant identifier |
| Role and membership | Registration, team invitation and platform administration; authorisation | `User.role`, `organizationId`, timestamps | User, same-tenant admin, platform `SUPERADMIN`; backend uses database-derived values | Service-controlled access data |
| Email-verification state and token | Service generated; prove mailbox control | Boolean, SHA-256 token hash and expiry in `User`; raw token sent by email and URL; 24-hour expiry. Successful use or retention cleanup clears token material. | Recipient has raw token; API/database stores hash; administrators can see verification-related user state only where returned | Service-controlled security data |
| Password-reset state and token | Service generated after a reset request from Login | SHA-256 hash and one-hour expiry in `User`; raw token sent by email and URL; success or expiry cleanup clears it | Recipient and API flow | Service-controlled security data. Anonymous request responses are identical for unknown accounts, delivery success and delivery failure. |
| Team invite temporary password | Generated by API for invited user | Only bcrypt hash persists. Plain value is sent in SES email; if delivery fails it is returned once to the inviting admin. `requiresPasswordChange` persists until password change/reset. | Invitee; inviting same-tenant admin only on delivery failure | Customer-triggered, service-generated credential |
| Subscription and Stripe IDs | Checkout, provider events and verification | `Organization.subscriptionStatus` and `stripeCustomerId`; no separate local subscription or invoice model | Organisation users via subscription endpoint; platform and backend | Service-controlled billing state |
| Website scan target | Anonymous visitor or authenticated user; run assessment | Normalised URL in `Scan.targetIdentifier`; query, fragment and URL userinfo removed before persistence | Raw summary to initiating public visitor; tenant members for claimed/authenticated scans; platform `SUPERADMIN` | Customer-submitted and contextual public target data |
| Social identifiers | Authenticated user; social assessment | `Scan.targetIdentifier`: page/account/property/company identifiers, usernames or WhatsApp phone number | Tenant members and platform `SUPERADMIN` | Customer-controlled; may identify individuals or sole traders |
| Scan state and output | Scanner generated | Type, status, score, risk level, sanitised embedded JSON findings, timestamps in `Scan` | Free callers receive severity-only summaries; active paid tenants receive full allowlisted findings; platform `SUPERADMIN` can inspect full output | Service-generated assessment data, contextual to customer target |
| Claim data | Public scan flow; establish possession and attach scan | SHA-256 claim-token hash and 24-hour expiry in `Scan`; raw 64-hex token returned once and held in browser session storage | Initiating browser has raw token; API stores hash; claim operation is tenant-bound and single-use | Service-controlled security/ownership data |
| DSR requester data | Public requester or customer admin; manage rights workflow | `DsrRequest`: email, optional name, type, optional details, status, due date, optional internal notes, created/resolved dates | Public submitter receives only new ID; paid tenant users can list all records, while only tenant ADMIN/SUPERADMIN can create or change status; platform `SUPERADMIN` can inspect limited details | Primarily customer-controlled processing on behalf of tenant; platform supplies workflow |
| Policy-generator input | Paid customer; generate a working policy draft | Business name, contact email, data categories, third parties and retention months are used in-process and returned in generated text; no database model or external AI call | Authenticated active subscriber and API process | Customer-controlled; transient in application code, but may enter operational logs if framework logging records bodies, which is not deliberately configured |
| Suppression data | SES operational bounce/complaint process or manual/provider integration | `SuppressionList`: complete email, reason, optional diagnostic detail and timestamp; no age-based deletion | Email service code; no customer UI found | Service-controlled email-delivery/security record. Code creating these rows was not identified in active routes. |
| Request/network metadata | HTTP requests, ALB/WAF/Fastify and rate limiting | Fastify uses `logger: true` and `trustProxy: 1`; public scan rate limiting deliberately uses `request.ip`. ALB/WAF and CloudWatch can process IP, URL, method, user agent and request identifiers. Exact fields emitted by defaults/provider sampling were not exhaustively fixed in code. | Operators/provider systems | Service-controlled security and operations |
| Application/provider errors | API, SES, Stripe and scanner operations | CloudWatch container logs. Safe helper allowlists error name/code/status/provider request ID; Stripe failures log type/code/status rather than full objects; emails are masked in suppression logs | Operators with AWS log access | Service-controlled operations; contextual personal data remains possible in framework request logs |
| Browser-held scan values | Public scanner and claim journey | `sessionStorage`, cleared selectively or when tab closes; legacy `localStorage` keys are deleted by registration | JavaScript in same origin/tab | Customer browser-controlled, service-created identifiers |
| Support correspondence | User emailing published mailbox | No application store or form; held by mailbox provider/process outside app | Mailbox operators | Service-controlled support process; provider and retention **BUSINESS CONFIRMATION REQUIRED** |

No database models exist for vendors, breaches, training, integrations, certificates or consent records. Those UI areas explicitly state persistence is unavailable; the consent GET returns an empty set and POST returns 501.

## 3. Special-category and high-risk data

| Category | Current exposure | Classification |
| --- | --- | --- |
| Health, criminal-offence, financial, identity-document and unrelated third-party data in DSR details | `reasonText` is free text, so submission remains technically possible. The public UI explicitly discourages passwords, payment details, identity documents and unrelated sensitive information. Backend enforces 2,000 characters but does not classify content. `internalNotes` exists in the database, although no active endpoint writes it. | Discouraged but technically possible; not intentionally required |
| Email/name as DSR subject data | Required email and public form-required name (API makes name optional) | Intentionally collected for DSR workflow |
| Public website content | Scanner fetches up to 5 MiB of the public HTML response and parses page text, forms, links and scripts in memory. It may incidentally encounter names, emails, sensitive narratives, query values or other published personal data. | Incidental observation; raw page HTML is not stored by the API |
| Scanner evidence | Website evidence is allowlisted, capped at 1,000 characters, removes URL userinfo/query portions and largely records counts/presence. TikTok can preserve a public bio URL as evidence; API sanitisation removes query values and embedded URL credentials. | Incidental/contextual; minimised but not guaranteed free of personal data |
| Social platform content | Facebook/Instagram scanner modules can analyse lead forms, posts/comments and preserve matched phone/email/identifier fragments in evidence, but active API requests do not send the required platform tokens, so these credentialed branches are not reachable through the current application. | Present in dormant internal scanner code; not supported by active API flow |
| Social identifiers and phone number | TikTok username, GA property ID and WhatsApp phone are accepted as active target strings. A phone number can be personal data. | Intentionally customer-submitted target data |
| Credentials/secrets | Website URL userinfo is rejected and query/fragment removed. Non-website targets are rejected when they resemble common API keys, bearer tokens, passwords, JWTs or long hex keys. Mailchimp target and route were removed. | Explicitly unsupported, with heuristic rejection. Internal scanner DTO still declares Facebook/Instagram/LinkedIn/Twitter token fields, but the API allowlisted payload cannot populate them. |
| Children's data | No child-specific collection, age gate or child account model found. DSR/scanner free text/public content could incidentally contain it. | Not intentionally supported; **BUSINESS CONFIRMATION REQUIRED** on eligibility/age policy |

Current DSR minimisation controls are frontend guidance, HTML `maxLength` attributes and authoritative TypeBox limits: organisation name 200, subject email 254, subject name 200 and reason text 2,000. Values are rejected rather than silently truncated. There is no special-category detector, attachment upload or identity-document flow.

## 4. Cookies and browser storage

| Exact name | Purpose and contents | Duration/cleanup | Flags/readability | Classification |
| --- | --- | --- | --- | --- |
| `__Host-token` | Signed JWT containing user ID (`sub`), organisation ID and role; API authentication | `Max-Age=3600` (one hour); logout expires it | HttpOnly; Path `/`; SameSite=Lax; Secure only when `NODE_ENV=production`; no Domain attribute. JavaScript cannot read HttpOnly value. | Technically necessary |
| `auth_payload` | Legacy browser-readable cookie; no creation or active consumer found | Logout sends an expiry (`Max-Age=0`) | Path `/`; SameSite=Lax; Secure in production; legacy cookie was JavaScript-readable | Not currently used; cleanup only |
| `freeScanId` | Public scan UUID used during registration journey | Same-tab `sessionStorage`; removed after successful registration/claim path or invalid data; browser normally clears at tab/session end | JavaScript readable | Necessary only for optional scan-claim journey |
| `freeScanClaimToken` | Raw one-time claim token | Same-tab `sessionStorage`; removed on registration success and after login claim attempt; otherwise tab/session lifetime and server token expires after 24 hours | JavaScript readable; not placed in application URL by this flow | Necessary only for optional claim journey; security-sensitive |
| `freeScanUrl` | Normalised target shown/carried in acquisition journey | Same-tab `sessionStorage`; removed on registration success; tab/session lifetime | JavaScript readable | Functional |
| `freeScanScore` | Public scan score | Same-tab `sessionStorage`; removed on registration success; tab/session lifetime | JavaScript readable | Functional |
| `scanClaimError` | Non-sensitive failure guidance string | Set in `sessionStorage` when login claim fails; explicit removal was not found | JavaScript readable; tab/session lifetime | Functional |
| Legacy local-storage keys | `freeScanId`, `freeScanClaimToken`, `freeScanUrl`, `freeScanScore` | The current scanner does not create them. Registration explicitly removes old persistent copies on entry and success. | JavaScript readable until removed | Legacy cleanup |

No `gdpr_cookie_consent` use remains in active source. No portal loader or SDK for Google Analytics/GA4, Meta/Facebook Pixel, Hotjar, Segment, Mixpanel, Plausible or a tag manager was found. Marketing/blog/scanner text *discusses or detects* analytics and pixels on scanned third-party sites; that is not portal tracking. Operational logging and WAF metrics are separate from customer behavioural analytics.

Whether the necessary cookie/storage needs consent is a legal determination: **LEGAL REVIEW REQUIRED**. The implementation currently provides information, not a preference UI, because no optional browser technology is loaded.

## 5. Database and retention

### Model inventory

| Model | Purpose/personal fields | Tenant/cascade | Retention and deletion |
| --- | --- | --- | --- |
| `Organization` | Name, optional industry, Stripe customer ID, subscription status, deletion request date, created/updated dates | Tenant root. Users, scans and DSRs reference it with `onDelete: Cascade`. | Active by default. Nullable indexed `deletionRequestedAt`; eligible 30 days after explicit request. Platform superadmin can delete immediately via a separate admin endpoint. |
| `User` | Email, password hash, name, role, verification/reset hashes and expiries, verification/password-change states, timestamps | Required organisation FK, cascade on organisation deletion | Retained with organisation; same-tenant admin and platform superadmin can delete individual users. Expired token material is cleared, not the user. |
| `Scan` | Target, type, status, score, risk, embedded findings/evidence, claim-token hash/expiry, timestamps | Optional organisation FK, cascade for claimed/authenticated scans | Authenticated scans eligible at 12 months from `createdAt`. Anonymous scans eligible 24 hours after non-null claim-token expiry. User can delete own-tenant scan immediately. |
| `DsrRequest` | Subject email/name, type, status, free text, internal notes, due/created/resolved dates | Required organisation FK, cascade | Only COMPLETED/REJECTED records with `resolvedAt` at least 24 months old are eligible. Open/reopened records are excluded. |
| `SuppressionList` | Email, bounce/complaint reason, optional diagnostic detail, created date | Global, not tenant-owned and not related to organisation | Explicitly excluded from age-based retention and organisation cascade. Separate reviewed removal decision required. |

### Implemented retention controls

- Dry-run is the default. `npm run retention:report` invokes the command without `--execute` and only returns aggregate eligible counts.
- Execution needs both `--execute` and exact environment confirmation `RETENTION_EXECUTION_CONFIRMED=DELETE_ELIGIBLE_RECORDS`. Supplying `--execute` without it throws before cleanup.
- All token clears and deletes execute inside one Prisma transaction; an error rejects the transaction rather than deliberately continuing item by item.
- Organisation: `deletionRequestedAt != null` and `<= now - 30 days`.
- Authenticated scan: non-null organisation and `createdAt <=` the calendar date 12 months earlier.
- Anonymous scan: null organisation and non-null claim expiry `<= now - 24 hours`.
- DSR: status COMPLETED or REJECTED and non-null `resolvedAt <=` calendar date 24 months earlier.
- Verification/reset token: hash present and expiry present and expired; action clears hash and expiry only.
- Suppression records are outside the retention client type and filters.
- No scheduler, cron or automatic deployment task invokes retention. Execution is operator-run.

Provider-side retention is different: staging ECS log groups default to 14 days; staging RDS automated backup retention is 3 days. S3 versioning/lifecycle, provider mail records, Stripe data, support correspondence, WAF sampled requests, CloudFront/ALB service data and backups/snapshots outside the active RDS setting are not deleted by application retention. Their complete retention is **BUSINESS CONFIRMATION REQUIRED**.

## 6. Account closure and offboarding

1. Stripe subscription events update `subscriptionStatus` to active, past_due or canceled. Cancellation changes billing/entitlement only; it neither sets `deletionRequestedAt` nor deletes data.
2. An authenticated ADMIN or SUPERADMIN can call `POST /api/account/deletion-request`. The API re-reads the user from PostgreSQL, derives the organisation from that user, uses no browser-supplied organisation ID and sets the nullable date only if it is currently null. Rate limit: three per minute.
3. During recovery, an authenticated ADMIN or SUPERADMIN can call `DELETE /api/account/deletion-request`; it clears the date for that same database-derived tenant.
4. After at least 30 days, the organisation is merely *eligible*. Nothing runs automatically. A separately authorised operator must run retention with both destructive safeguards.
5. Execution deletes the organisation. Database cascades delete its users, scans/findings and DSRs. Global suppression records do not cascade. Stripe, SES, logs, backups, browser storage and support mailbox records are outside this operation.

No customer-facing Settings control invoking these deletion APIs was found. The backend foundation exists but the normal customer UI does not expose it. The platform `SUPERADMIN` admin route can delete any organisation immediately and is not tied to the 30-day workflow; this is a privileged support/administrative function that final offboarding procedure must govern.

Unresolved: who approves/runs cleanup, identity/re-authentication expectations for deletion requests, legal holds, deletion confirmation, provider-side deletion, treatment of the last administrator, recovery support, Stripe customer deletion and evidence/audit of completed deletion are **BUSINESS CONFIRMATION REQUIRED**.

## 7. Scanner processing

### Website flow

1. A visitor submits a public HTTP/HTTPS website string; authenticated users submit the same plus a scan type. Public scans are additionally rate-limited by source IP and normalised hostname.
2. API normalisation trims input, defaults missing scheme to HTTPS, permits HTTP/HTTPS only, requires a hostname, rejects URL username/password, and strips query and fragment before storing or sending it.
3. API creates a `Scan`. An anonymous scan has no organisation and stores only a SHA-256 hash of a 64-hex claim token plus a 24-hour expiry. The raw token is returned once.
4. API calls the private scanner service with an allowlisted DTO, customer/guest identifier and URL, authenticated by `X-Scanner-Api-Key`.
5. The scanner permits HTTP/HTTPS only, rejects embedded credentials, invalid ports, single-label/internal suffixes, selected protected domains and any DNS answer that is private, loopback, link-local, reserved, multicast or unspecified. It revalidates and pins DNS on every redirect, allows at most five redirects, has a ten-second request timeout and 5 MiB response limit.
6. It GETs the target/redirect destination using a scanner user agent, parses returned HTML in memory, and checks HTTPS, selected tracker script sources, forms/checkbox text, privacy-policy links, privacy/DPO-contact wording, DSR wording and UK GDPR references.
7. API accepts only 500 findings and allowlists defined string/boolean fields. Strings are capped at 2,000; website evidence at 1,000. Error findings are replaced with generic descriptions and no detail. Website URL userinfo/query values in evidence are removed. Raw HTML is not persisted.
8. PostgreSQL stores target, status, score, risk and embedded sanitised findings. Free responses expose only severity per non-pass finding, allowing counts/distribution, plus scan summary fields. Detailed findings/evidence/remediation/legal context remain available only to active paid tenants; platform superadmins can inspect full records.
9. A token holder can atomically claim an unexpired, unowned scan into the authenticated user’s database-derived organisation. Hash/expiry are cleared. A token is single-use and scan ID alone is insufficient.
10. Repeat assessment is manual creation of another scan. There is no schedule, automatic monitoring, alert or formal comparison record.

### Social flow and destinations

The API accepts Facebook page ID, Instagram account ID, LinkedIn company ID, X/Twitter username, GA property ID, WhatsApp phone and TikTok username. It rejects credential-looking targets and sends only explicit identifier fields, never object spreads or credential fields. Mailchimp is absent from active scan enums, frontend choices and API DTO construction.

The scanner’s internal `SocialScanRequest` still contains optional Facebook, Instagram, LinkedIn and Twitter credential fields. Active API calls never populate them, so those provider calls do not execute through the product. GA and WhatsApp modules currently return informational/static findings without provider API calls. TikTok performs a public GET to `www.tiktok.com/@<username>` and may preserve a bio-link URL as evidence. Credentialed dormant modules name `graph.facebook.com`; they should not be described as live functionality.

External destinations actually contacted are the customer-instructed website and its validated public redirects, TikTok for a TikTok target, and DNS/TLS/network providers involved in those requests. Destination hosting jurisdiction and any target-site response data are contextual and not established by the repository.

Incidental personal data can appear in public HTML or target identifiers. The current website finding logic stores counts/presence and limited URLs rather than form values or raw page text, reducing but not eliminating this risk.

## 8. DSR processing

- Public route: `POST /api/public/dsr`, unauthenticated. It accepts exact organisation name (2–200), email (valid, max 254), optional name (max 200), request type and optional details (max 2,000). The UI requires name even though API does not.
- Request types: ACCESS, ERASURE, RECTIFICATION, PORTABILITY and RESTRICTION.
- It exact-matches `Organization.name`; absent name returns `404 Organisation not found`, while success returns a new record ID. This reveals whether an organisation name exists and therefore presents a remaining organisation-enumeration risk.
- Public submission performs no automated identity verification, attachment collection or email acknowledgement. The organisation/customer remains responsible for verification and the substantive response.
- Authenticated DSR endpoints require a database-backed user in an organisation whose subscription status is active. Listing is tenant-scoped. Any paid tenant member can list complete DSR rows, including full requester email and free text; ADMIN/SUPERADMIN is required to create or change status.
- New requests get PENDING and a due date calculated as 30 days after creation. Supported statuses are PENDING, IN_REVIEW, APPROVED, REJECTED and COMPLETED.
- Entering COMPLETED or REJECTED sets `resolvedAt` if absent; reopening clears it. Closed records are eligible after 24 months. Organisation deletion cascades them.
- The UI warning discourages passwords, payment details, identity documents and unrelated sensitive information. Backend lengths are authoritative and oversized values are rejected. Blank optional strings and whitespace-only optional values are not normalised/rejected.
- `internalNotes` exists in the schema but no current route for entering/updating it was found.

PrivacyReady appears operationally to process tenant DSR records for the customer, but final controller/processor classification and customer instructions require legal confirmation.

## 9. Email processing

| Flow | Trigger, recipient and content | Tokens/persistence/logging |
| --- | --- | --- |
| Verification | Registration, resend or team invitation; recipient email/name; verification URL | Raw token in email URL; SHA-256 hash and 24-hour expiry in `User`. Failures log safe metadata only. Registration leaves token state if delivery fails; resend replaces it. |
| Password reset | Login calls API `forgot-password`; email/name and reset URL; the `/reset-password` page submits the token, user ID and new password to the existing reset endpoint | Raw token in URL; SHA-256 hash and one-hour expiry. Delivery failure clears hash/expiry and logs safe metadata. The anonymous request response is conditional and does not claim delivery occurred. Successful token use replaces the password hash and clears reset state. |
| Team invite | Tenant admin creates teammate; email, name, organisation name, temporary password and verification URL | Temporary password is emailed and only bcrypt hash persists. If delivery fails, it is returned once to admin; safe metadata logged. |
| Suppression check | Before every send | Complete recipient email is queried in PostgreSQL. Suppressed send logs a masked email and suppression reason. |

Provider is AWS SES (`@aws-sdk/client-ses`), configured from `AWS_REGION` with `eu-west-2` fallback. Default/from configured address is `no-reply@notify.privacyready.co.uk`; staging IAM restricts sending to the SES domain identity and exact from address. No Reply-To is set. SES returns provider response metadata to the caller but email contents are not persisted by application code. Provider-side message metadata/content retention and whether production access is currently enabled are **BUSINESS CONFIRMATION REQUIRED**.

Support correspondence uses `hello@privacyready.co.uk`; deployment documentation separately says Names.co.uk hosts `support@`, `demo@` and staff mailboxes. The provider for `hello@`, access, forwarding and retention are **BUSINESS CONFIRMATION REQUIRED**.

## 10. Stripe and billing

- Checkout is authenticated and tenant identity is re-read from the database. The API sends mode `subscription`, payment method type `card`, the authenticated user email, organisation ID as `client_reference_id`, allowlisted success/cancel URLs, plan price ID where configured, or inline GBP monthly product name/description and amount.
- Current amounts are Founder £15/month (1,500 pence) and Growth £39/month (3,900 pence). Backend entitlement is simply `subscriptionStatus === active`; no evidenced feature difference exists between these plans.
- API receives checkout session ID/URL, status/payment status, customer ID and client reference. It returns session ID/URL to browser and stores only `stripeCustomerId` and mapped subscription status locally. It does not store Stripe session, subscription, invoice or price IDs in PostgreSQL.
- Session verification fetches Stripe by session ID and requires paid/complete status plus matching organisation reference before activating the caller’s tenant.
- Webhooks verify the raw-body HMAC signature with five-minute timestamp tolerance. Handled events are checkout completion, subscription updated/deleted and invoice payment failed. They update the organisation mapped by client reference or customer ID.
- Billing portal creation sends stored Stripe customer ID and an allowlisted same-origin return URL; the browser receives the portal URL.
- Card entry occurs on Stripe-hosted checkout. No code receives or stores full card number, CVC or payment instrument details.
- Subscription cancellation updates status to canceled and removes active entitlement. It does not request/delete an account.
- Errors log only provider type/code/HTTP status or safe error metadata, not entire Stripe sessions, events or secrets.

Stripe contracting entity, processing locations, transfer mechanism, provider-side retention, refunds, invoicing/tax data, chargebacks and contractual cancellation timing are **BUSINESS CONFIRMATION REQUIRED**.

## 11. Logging and telemetry

- Fastify uses Pino-compatible `logger: true` and trusts one proxy. Default request logging can include request ID, method, URL, hostname, remote address/port and response status/timing. Exact deployed logger serialisers/redaction are not customised in repository code.
- `request.ip` is explicitly processed for public scan abuse control, combined in an in-memory map with normalised hostname for a one-minute window. The map is per process and has no explicit eviction of keys beyond filtering on reuse.
- API/scanner stdout and stderr go through ECS `awslogs` to `/ecs/<service>` CloudWatch log groups, configured for 14 days by default in `eu-west-2`.
- `safeErrorMetadata` allowlists error name, code, status and provider request ID with length limits. It deliberately omits message, stack, request body, headers and arbitrary provider objects. Suppression logs mask the local part of email.
- Changed operational paths use safe metadata for authentication-email, team-email, scanner, Stripe and startup errors. Stripe API error logs type/code/status only.
- Scanner catches website/provider exceptions and returns generic scan errors; it does not deliberately log request payloads in application code. Framework/access logging behaviour still needs deployment verification.
- WAF has CloudWatch metrics and sampled-request support driven by variables. Staging uses the module defaults unless overridden; sampled requests may contain request metadata, but there is no WAF log-destination resource. ECS Container Insights is enabled, and CloudWatch alarms cover ALB, ECS and RDS metrics.
- Operational telemetry is not analytics. No portal behavioural analytics exists.

Remaining risks: URLs can contain route/query values at the API boundary, Fastify defaults may record them; client-side `console.error` can contain JavaScript error objects; ALB/WAF/provider logs may include IP/user agent/path; target identifiers and DSR/email values could enter unexpected validation/framework errors. A deployed log sample and operator access/retention review are **BUSINESS CONFIRMATION REQUIRED**.

## 12. Evidence-backed security controls

- Passwords use bcrypt cost 12. Temporary team passwords are generated with cryptographic randomness and marked for change.
- Verification, reset and claim tokens use cryptographic randomness; only SHA-256 hashes persist; comparison is timing-safe for verification/reset, and scan claims use a hash plus conditional atomic write.
- Authentication uses a signed one-hour JWT in the HttpOnly `__Host-token`; database user/org/role are re-read for protected functional routes. Logout expires auth and legacy cookie.
- Registration does not authenticate before email verification; login rejects unverified accounts and uses generic invalid-credential responses/dummy hash to reduce enumeration/timing signals.
- Tenant filters derive organisation from the authenticated database user for scans, DSRs, team and account deletion. Admin roles are checked server-side. Platform-wide admin routes require database-derived SUPERADMIN.
- Active subscription checks are server-side for DSR, policies and consent; scan output is reduced server-side for non-active tenants.
- Public scan results expose severity-only finding entries, not diagnostic fields. Claim tokens are single-use, expiring and ownership-bound.
- Scanner service is in private application subnets without public IP/load balancer/DNS, accepts API security-group ingress only and requires a shared secret. Website SSRF controls re-resolve/pin every hop and restrict scheme/address/redirect/size/time.
- Staging RDS is encrypted, private, not publicly accessible and reachable only from API security group. S3 frontend and Terraform-state storage use server-side encryption and public-access blocks. Which AWS-managed keys apply is configuration-specific.
- ALB and CloudFront terminate TLS; HTTP redirects to HTTPS; CloudFront minimum TLS is 1.2. Helmet, credentialed allowlisted CORS, unsafe-origin checks, route/application rate limiting and regional WAF are configured.
- Secrets are injected from AWS Secrets Manager with IAM resources scoped in Terraform; no secret values were inspected.
- Stripe webhook signatures and checkout tenant references are verified; provider failures use bounded safe logging.
- Retention is dry-run-first, doubly confirmed for execution and transactional.

These are implementation facts, not guarantees. Key management details, vulnerability management, incident response, backups restoration, staff access, MFA, security testing cadence and production operational effectiveness need separate confirmation.

## 13. External service and preliminary subprocessor inventory

Classifications are technical screening categories, not final legal conclusions: **A** likely customer-data subprocessor, **B** infrastructure/support service requiring legal review, **C** development/source service with no demonstrated production customer data, **D** customer-instructed external target, **E** unclear.

| Provider/service | Function and possible data | Location evidence | Screen |
| --- | --- | --- | --- |
| AWS ECS/Fargate | Runs API and scanner; processes all application request, account, DSR, scan and billing metadata in memory | Staging provider `eu-west-2` | A |
| AWS RDS PostgreSQL | Stores all five application models and embedded findings | `eu-west-2`; private encrypted RDS | A |
| AWS CloudWatch Logs/metrics/Container Insights | Container logs, request/operational metadata and infrastructure telemetry | ECS log groups use staging region `eu-west-2`; AWS service internals not fully established | A/B |
| AWS SES | Sends account/team/reset transactional email and receives recipient/content | Code and IAM use `eu-west-2` | A |
| AWS S3 | Hosts static portal assets; separate S3 backend stores Terraform state, not demonstrated customer application records | Provider defaults `eu-west-2`; frontend request logs are not configured | B; no demonstrated stored customer data in frontend bucket |
| AWS CloudFront | Global delivery of public SPA; can process viewer IP/request metadata | Global; viewer certificate in `us-east-1` | A/B |
| AWS ALB and WAF | Public API ingress, TLS, rate limiting/rule evaluation; request/IP metadata and sampled requests | Regional `eu-west-2` | A/B |
| AWS Route 53 | DNS routing; DNS query metadata may be processed by AWS but query logging is not configured | Global service | B |
| AWS ACM | TLS certificates and validation data | API certificate `eu-west-2`; CloudFront viewer certificate `us-east-1` | B; no demonstrated application content |
| AWS Secrets Manager | Runtime secrets, including JWT, scanner and Stripe secrets plus AWS-managed RDS master secret | Staging region `eu-west-2` | B; security credentials rather than ordinary customer content |
| AWS ECR | API/scanner images | Staging region `eu-west-2`; no demonstrated customer production data | B/C |
| AWS Cloud Map/VPC/NAT | Private scanner discovery and network transport; destination metadata may transit network services | `eu-west-2` | B |
| Stripe | Checkout, subscription/customer portal and webhooks; email, organisation reference, customer/subscription/payment metadata | Location/entity not established | A; final status required |
| Names.co.uk mailbox hosting | Documentation says support/demo/staff mailboxes; may store support correspondence and staff data | Not established | A/E; `hello@` provider unconfirmed |
| GitHub | Source repository | No production customer-data integration demonstrated; repository artefacts may contain synthetic test data and configuration | C |
| Customer-selected websites and redirects | Scanner GET of public HTML | Destination-defined and potentially worldwide | D |
| TikTok public website | GET of public profile for submitted username | Not established | D |
| Facebook/Instagram/LinkedIn/X APIs | Scanner modules exist but active API does not provide required credentials; no live product flow established | Not established | E/dormant, do not publish as current subprocessor flow |

## 14. Data-location conclusions

The repository supports the carefully bounded statement: **“Core PrivacyReady application infrastructure and customer database services are configured for AWS London (`eu-west-2`).”** ECS API/scanner, RDS, CloudWatch log groups, SES identity/use, S3 origins, WAF/ALB, ECR, Secrets Manager and VPC are configured through the London-region staging provider.

Exceptions and qualifications:

- CloudFront is global, and its required ACM viewer certificate is configured in `us-east-1`.
- Route 53 and CloudFront are global AWS services.
- Stripe region/entity and transfers are not established.
- Mailbox provider processing locations are not established.
- GitHub source hosting location is not established, although no production customer dataset is shown there.
- Customer-instructed target websites, redirects and TikTok can be anywhere.
- SES/provider-side routing and metadata location beyond configured region are not completely established by application code.

The repository **does not support** saying “All customer data remains in the UK.” The global edge, external billing/mail services, customer-selected targets and provider-side processing/transfer unknowns prevent that claim.

## 15. Preliminary controller/processor map

This is not legal advice and states no lawful basis.

| Activity | Preliminary role | Factual reason / decision needed |
| --- | --- | --- |
| PrivacyReady account administration and verification | Likely controller | PrivacyReady determines account/security mechanics and stores user identity. Contract/customer relationship needs confirmation. |
| Billing/subscription and fraud/security checks | Likely controller | PrivacyReady selects plans, sends checkout metadata and controls entitlement. Stripe relationship needs confirmation. |
| Customer support correspondence | Likely controller | PrivacyReady determines support operation; mailbox governance unknown. |
| Security, abuse prevention and operational logging | Likely controller | PrivacyReady configures authentication, logging, rate limits and WAF for its service. |
| Customer-directed scans and stored findings | Context-dependent; likely processor for customer target data, possibly controller for service security/assessment operation | Customer selects targets, while PrivacyReady defines scanner mechanics, score and retention. **LEGAL REVIEW REQUIRED**. |
| Customer DSR workflow records | Likely processor for the customer, with controller role for platform security/operations | Tenant submits/manages third-party requester records; PrivacyReady provides and retains platform. Instructions and responsibilities require DPA. |
| Policy generation | Likely processor/context-dependent | Customer supplies business/personal-data details; deterministic transient generation. No model storage. |
| Team management | Likely controller and/or context-dependent | Customer admin invites staff; PrivacyReady controls account security and email delivery. Employment/member context is customer-directed. |
| Suppression records | Likely controller | PrivacyReady uses them to prevent problematic/unwanted transactional sends and protect service reputation. Source/process needs confirmation. |

## 16. Lawful-basis drafting inputs

No lawful basis is determined here. Every row is **LEGAL REVIEW REQUIRED**.

| Activity | Data | Operational purpose | Decision required | Evidence |
| --- | --- | --- | --- | --- |
| Account creation/use | Name, email, organisation, password hash, role | Provide and secure account | Basis, mandatory fields, contract party and non-customer user handling | Auth routes/schema |
| Verification/reset/invites | Email, name, tokens, temp password | Account security and access | Basis, delivery records, failed-delivery handling | Auth/team/email |
| Billing | Email, org reference, Stripe customer/status | Checkout, entitlement, cancellation | Basis, accounting retention, Stripe roles | Billing route/schema |
| Website/social assessments | URLs, identifiers, public content, findings | Customer assessment | Controller instructions, authority to scan, incidental data handling | Scan API/scanner |
| Public scan abuse prevention | IP and hostname/time | Limit abuse and protect service | Basis and short retention disclosure | `request.ip` rate map/WAF |
| DSR workflow | Requester identity, type, details, status/notes | Help tenant manage rights requests | Customer instructions, controller/processor allocation, special-data rules | DSR route/schema |
| Policy generation | Business/contact/data/processor inputs | Produce working draft | Processor instructions and transient processing | Policy route |
| Team administration | Member name/email/role | Workspace membership | Customer vs PrivacyReady responsibilities | Team route |
| Logs/security | IP, request metadata, IDs/errors | Security, reliability, investigation | Basis, access and retention | Fastify/CloudWatch/WAF |
| Suppression | Email, bounce/complaint reason/detail | Prevent repeated/problem sends | Basis, source, notice, retention and challenge correction | Email/schema/retention |
| Support | Correspondence/contact data | Answer enquiries/support accounts | Basis, retention and sensitive-data process | Public contact/login/docs |

## 17. International-transfer inputs

Before drafting transfer wording, confirm:

- AWS contracting entity, service-specific data residency/transfer terms, support access and any subprocessor chain for ECS, RDS, CloudWatch, SES, CloudFront, WAF, S3 and global services.
- Stripe contracting entity, processing/storage locations, subprocessors, transfer mechanism and provider retention.
- Provider and locations for `hello@privacyready.co.uk` and Names.co.uk-hosted mailboxes, including backups, spam filtering and forwarding.
- Whether any operational support/vendor can access AWS data from outside the UK.
- CloudFront/global edge logs and request metadata handling; ACM `us-east-1` contains certificate data, not shown customer database content.
- Customer-directed scans necessarily make requests to target sites/redirects in their locations; TikTok profile scanning reaches TikTok.
- GitHub organisation/entity/location and whether issues, support artefacts or diagnostics ever contain customer data; current source shows no production customer-data feed.

Do not assert SCCs, UK IDTA, adequacy, transfer impact assessments or a provider entity until contracts/business records confirm them.

## 18. Terms and product facts

| Topic | Current implementation fact |
| --- | --- |
| Pricing/frequency | Founder £15/month and Growth £39/month, GBP recurring monthly. No evidenced backend feature distinction; both map to active paid entitlement. |
| Free scan | Anonymous website scan; summary contains target/status/score/risk and severity-only issue entries, plus one-time claim token. No payment details required by the scan route. |
| Paid access | Active subscription unlocks detailed scan findings/evidence/remediation, DSR endpoints, policy generation and empty consent read. |
| Cancellation | Managed through Stripe portal/provider events; changes entitlement only. Refund timing/rights are absent. |
| Assessments | Public website checks plus authenticated target types. Results concern observable signals, are not legal advice/certification, and can be manually repeated. |
| Monitoring | No scheduled scans, automatic change detection or alerts. Public copy says not currently available/coming soon. |
| Remediation help | Stored findings may contain remediation guidance. Manual help is a contact-email proposition; no managed-remediation workflow, ticket, SLA or fixed fee. |
| Reports/certificates | No PDF report or certificate-generation implementation. Certificate UI says coming soon and no accredited/persistent mechanism exists. |
| DSR/policy | DSR workflow is persisted and premium; identity verification is not automated. Policy generation is deterministic, premium, transient and creates a working draft. |
| Other workspaces | Consent persistence unavailable; vendors, breaches, training and integrations have no persistent models and are presented as unavailable/coming soon. |
| Repeat scans | Users create independent scans; no automatic comparison object. Public wording describes comparing scores/results manually. |
| Account deletion | Backend explicit request/cancel foundation with 30-day recovery and operator-run cleanup; no normal customer UI was found. Privileged platform delete is immediate. |
| Availability | Terraform configures one API and one scanner task by default, single-AZ staging RDS and no uptime/SLA mechanism. Terms should not imply an SLA without business commitment. |
| User responsibilities | User supplies account accuracy, target URLs/identifiers and DSR/policy data. Code rejects credential-like targets and URL credentials; authority to scan and prohibited data/targets need express business/legal terms. |
| Existing Terms claims | Not legal advice; user accountable for compliance; DPA not automatic; broad limitation and price/service-change clauses are present. Their enforceability and policy are **LEGAL REVIEW REQUIRED**. |

## 19. Factual DPA input sheet

| DPA input | Repository fact |
| --- | --- |
| Subject matter | Hosting and operation of tenant accounts, customer-instructed privacy assessments, findings, DSR workflow and deterministic policy drafting tools. Exact contracted service scope **BUSINESS CONFIRMATION REQUIRED**. |
| Duration | Active organisation data while account active; termination does not itself delete. Explicit deletion becomes eligible after 30 days. Provider copies and contractual return/deletion timeline need confirmation. |
| Nature | Receive/store/retrieve/organise/display/delete tenant records; fetch public target sites; analyse observable signals; generate scores/findings/guidance; send transactional email; facilitate billing. |
| Purposes | Provide customer workspace, assessments, remediation information, DSR tracking, policy draft and team/account administration; security and service operation. Customer documented purposes/instructions **BUSINESS CONFIRMATION REQUIRED**. |
| Data subjects | Customer users/team members; website/social account owners/operators; people mentioned on public scanned pages; customer’s DSR requesters; support contacts. |
| Personal-data types | Names, work/personal emails, membership/roles, organisation data, site/social identifiers, public site signals/content fragments, DSR details/notes/status, policy inputs, billing IDs/status, request/IP metadata and tokens/hashes. |
| Special-category possibility | Not required, but possible in DSR free text/internal notes or incidentally on scanned pages; no attachments or classification controls. |
| Services/subprocessors | AWS infrastructure/SES/logging; Stripe; support mailbox; customer-selected target sites. Final list, entities and approval/change process require confirmation. |
| Deletion/return | Database retention rules above; operator-run destructive action only. No data export/return workflow, legal hold or comprehensive provider deletion is implemented. |
| Security | Controls in section 12, including hashing, HttpOnly cookie, database-derived tenancy/roles, entitlement, SSRF protection, encryption/TLS, private network, Secrets Manager, webhook verification, redaction and guarded retention. |
| DSR assistance | Tenant DSR intake/list/status tracking and due dates. No automated identity verification, data discovery/export/erasure across systems or response generation. |
| Incident assistance | WAF, CloudWatch logs/alarms, Container Insights and runbooks provide operational evidence. No customer incident-notification workflow or contractual timeframe is encoded. |
| Audit/evidence | Source/tests, Terraform, CloudWatch logs/metrics, retention aggregate reports and deployment verification exist. No customer audit portal, certification, immutable audit model or ROPA model. |
| Instructions/confidentiality | Tenant selection of targets and supplied DSR/policy data evidences instructions. Staff confidentiality, instruction change/rejection process, audit terms and full Article 28 obligations are **LEGAL REVIEW REQUIRED**. |

## 20. Proposed technical service inventory for legal review

| Provider/service | Function | Potential data | Evidenced location | Customer data | Final classification |
| --- | --- | --- | --- | --- | --- |
| AWS ECS/Fargate | API/scanner compute | All request/account/scan/DSR/billing metadata in process | eu-west-2 | Yes | Required |
| AWS RDS | Primary PostgreSQL | All persisted application models | eu-west-2 | Yes | Required |
| AWS CloudWatch | Logs, metrics, alarms, Container Insights | Request/IP/error/operational identifiers | eu-west-2 for configured log groups | Yes/contextual | Required |
| AWS SES | Transactional email | Recipient, name, organisation, token links/temp password, message | eu-west-2 configured | Yes | Required |
| AWS S3/CloudFront | Portal hosting and global delivery | Viewer request metadata; no app DB records in static bucket | S3 eu-west-2; CloudFront global | Context-dependent | Required |
| AWS ALB/WAF | API ingress/protection | IP, headers, paths and sampled request metadata | eu-west-2 | Yes/contextual | Required |
| AWS Route 53/ACM | DNS/TLS | DNS and certificate metadata | Global; ACM eu-west-2 and us-east-1 | Normally no application content | Required |
| AWS Secrets Manager/ECR/Cloud Map/VPC | Secrets, images, discovery/network | Credentials and operational network metadata | eu-west-2 | Context-dependent | Required |
| Stripe | Checkout/subscription/portal | Email, org reference, customer and payment/subscription metadata | Unknown | Yes | Required |
| Mailbox provider | Support/privacy correspondence | Sender, message and attachments if sent | Unknown | Yes | Required |
| Target website/redirect hosts | Customer-directed scan destination | Scanner IP/request; public response content | Target-defined | Context-dependent | Required as recipient/instruction category |
| TikTok | Public profile assessment | Submitted username and public profile response | Unknown | Context-dependent | Required if retained feature |
| GitHub | Source development | No demonstrated production customer data | Unknown | No, on current evidence | Review as development supplier, not automatically a subprocessor |

## 21. Current legal-document discrepancies

| Document/location | Current claim | Implementation evidence | Assessment | Drafting action |
| --- | --- | --- | --- | --- |
| Privacy, Information We Collect | Name, email, organisation; automatically IP, browser type and usage data | Account fields and IP processing are evidenced. Fastify/edge may see browser/user-agent and request usage, but exact logging is not specified. Omits scans, social IDs, DSRs, billing IDs, tokens, email, suppression, logs and policy inputs. | Incomplete/partly supported | Replace with activity-specific inventory and qualify automatic telemetry. |
| Privacy, uses | Contract/services only | Security, verification, billing, scanning, DSR, support, suppression and retention purposes exist. | Incomplete | Add purposes; lawful bases remain **LEGAL REVIEW REQUIRED**. |
| Privacy, sharing | Hosting/payment providers “bound by confidentiality obligations” | AWS and Stripe use is evidenced; contractual confidentiality is not in repo. SES/mail/global edge/target destinations omitted. | Incomplete; contract claim unverified | List provider categories/current services after contracts confirmed. |
| Privacy, rights/contact | General UK GDPR rights and address | Rights text is present; application only provides tenant DSR workflow, not complete PrivacyReady rights handling. Address accuracy and exceptions unverified; ICO complaint right omitted. | Incomplete/business confirmation | Confirm controller contact/address, workflow, identity checks, rights/exceptions and ICO wording. |
| Privacy, security | “reasonable security measures” | Multiple technical controls are evidenced. | Broadly supported but generic | Describe factual categories without guarantees. |
| Privacy overall | No retention, transfers, role allocation, children, cookies/browser storage, account deletion or source details | All require disclosure/decisions. | Incomplete | Redraft comprehensively from this record. |
| Terms, service | “software tools for managing data privacy compliance” and automated scans/policy generator/recommendations are not legal advice | Scanner/policy/DSR tools exist; some workspaces are placeholders. | Partly supported | Define available vs coming-soon features and assessment limits. |
| Terms, DPA | DPA may be required; use does not establish one exists | No DPA in repo. | Accurate caution | Draft and establish contracting process separately. |
| Terms, account security | Accurate registration information and password responsibility | Account/password mechanisms exist. | Supported but incomplete | Add verification/team/credential/target responsibilities and suspension/access facts. |
| Terms, liability/price/service changes | Broad exclusion, 12-month cap, 30-day price notice, unilateral discontinue | Text is present; implementation cannot prove policy/enforceability. | **LEGAL REVIEW REQUIRED** | Owner/solicitor must approve, not derive from code. |
| Terms, billing | No plan, renewal, cancellation, refund, tax or failed-payment detail | Monthly Stripe checkout, portal and status mapping exist. | Incomplete | Add confirmed commercial policy; do not invent refunds. |
| Cookie/browser storage | Describes `__Host-token`, one-hour duration, HttpOnly/Lax/Secure production; exact public-scan session-storage keys and `scanClaimError`; legacy cleanup; no analytics | Matches active code. Secure is conditional in development. | Accurate | Preserve. |
| FAQ, scan claims | Observable signals; no legal advice/guarantee; repeat manual; no scheduled monitoring | Matches scanner and public copy. | Supported | Preserve bounded wording. |
| FAQ, paid tools | Paid plans add details/evidence/remediation and operational tools | Active status exposes detailed findings and DSR/policy; several operational areas are unimplemented. | Partly supported | Name live tools and avoid implying all navigation workspaces persist. |
| FAQ, tenant separation | Server scopes organisation records | Core customer routes re-read DB tenant; SUPERADMIN has platform access. | Supported with privileged-access qualification needed in policy | Explain authorised staff/admin access. |
| Login/reset flow | Login now calls the implemented reset-request endpoint; the emailed `/reset-password` route consumes the existing token endpoint; request wording remains identical for unknown accounts and delivery outcomes | Token hashes, expiry, delivery-failure invalidation and safe logging remain server-side. | Accurate after bounded remediation | Preserve enumeration-resistant conditional wording. |
| Registration/verification delivery wording | Registration and resend previously claimed an email had been sent even after provider failure | Anonymous responses are now conditional and remain identical across account/delivery states. | Accurate after bounded remediation | Preserve conditional wording. |
| DSR public page | Submits to a named organisation and now uses neutral “Powered by” attribution | Backend stores a record for an exact organisation match; no identity verification; exact-name 404 still permits enumeration. | Partly supported; remaining product/security decision | Retain service-limit wording and resolve discovery model separately. |
| Company/address | Ltd/name/number/jurisdiction/address | Only public-copy evidence | **BUSINESS CONFIRMATION REQUIRED** | Verify against authoritative corporate records. |

### Implementation discrepancy classification after bounded remediation

| Classification | Items | Current treatment |
| --- | --- | --- |
| **A. CODE DEFECT** | Password-reset API was disconnected from Login, emailed reset links had no React route, and anonymous reset/verification responses made false delivery claims after provider failure | Fixed in the current uncommitted remediation. Token creation, hashing, expiry, failure invalidation, safe logging and enumeration-resistant response equality remain server-side. |
| **B. COPY/DOCUMENTATION DEFECT** | Browser-storage page omitted exact session-storage keys and `scanClaimError`; public DSR attribution used the unsupported broad phrase “Powered securely” | Corrected narrowly. No legal policy or analytics preference was added. |
| **C. BUSINESS DECISION REQUIRED** | Public DSR tenant discovery/enumeration model; company/contact facts; provider contracts/locations/retention; email operational readiness; offboarding approvals/legal holds/provider deletion; suppression governance; dormant social scanning; support and commercial policies | Unchanged and explicitly marked **BUSINESS CONFIRMATION REQUIRED**. A non-enumerating DSR design needs an owner-approved opaque tenant link/identifier or equivalent workflow; changing response text alone would either still disclose success or falsely imply submission. |
| **D. LEGAL REVIEW REQUIRED** | Lawful bases; controller/processor allocation; Article 28 terms; international-transfer mechanisms; rights wording/exceptions; liability, governing law, refunds and other contractual positions | No implementation or legal-page decision made. Mark **LEGAL REVIEW REQUIRED** during drafting. |
| **E. ACCEPTABLE CURRENT LIMITATION** | No analytics/consent UI; manual repeat assessments only; no automated monitoring; placeholder workspaces explicitly unavailable; operator-run retention; no PDF/certification/managed-remediation workflow; dormant credential fields not reachable from the allowlisted API | Retained and described factually. These limitations must not be marketed as live capabilities. Logging/provider telemetry and the absence of a normal account-deletion UI remain operational follow-ups, not facts to conceal. |

## 22. Business facts required from the owner

1. Confirm legal entity name, company number, jurisdiction, registered office and appropriate service/privacy addresses.
2. Confirm ICO registration/reference and whether a DPO is formally appointed; if not, name the responsible privacy contact/function.
3. Confirm who owns and monitors `hello@`, `support@`, billing and DPA contacts, their provider(s), access controls and retention.
4. Decide lawful bases for every activity in section 16 and whether PrivacyReady acts as controller, processor or both for scans, DSRs, policies and team data.
5. Confirm AWS and Stripe contracting entities, subprocessor terms, locations, international-transfer mechanisms and provider-side retention/deletion.
6. Confirm support mailbox, spam-filtering, forwarding and backup providers/locations.
7. Approve a published subprocessor list and notice/objection process.
8. Define customer instructions and authority to scan submitted sites/platform identifiers, acceptable use and credential prohibition.
9. Decide whether social identifier/TikTok scanning remains a supported product and whether dormant credential-bearing scanner DTO/modules should be removed.
10. Decide whether the public DSR endpoint’s organisation-name enumeration is acceptable or needs a non-enumerating discovery/link model.
11. Define identity-verification responsibility, special-category handling and whether DSR internal notes will be exposed.
12. Confirm transactional email production readiness, delivery monitoring and Reply-To behaviour for the now-connected password-reset and verification flows.
13. Establish deletion/offboarding approval, re-authentication, legal holds, customer confirmation, provider deletion, export/return and evidence of deletion.
14. Define suppression-record source, correction/removal process and retention justification.
15. Define accounting/billing record retention, Stripe customer deletion, refunds, renewals, failed-payment handling, taxes and cancellation effective date.
16. Approve Terms positions on governing law/jurisdiction, age/eligibility, acceptable use, service availability/SLA, suspension, liability, indemnity, price changes and refunds.
17. Define breach-response ownership, customer notification commitments and incident/contact process.
18. Confirm staff/contractor access, confidentiality, MFA, security review, vulnerability management and audit evidence that can contractually be promised.
19. Confirm provider-side log, WAF/edge, backup, SES, support and Stripe retention, plus historical scanner-record sanitisation/backfill policy.
20. Decide whether customer data export/return is offered before deletion and how requests are authenticated.

## Overall drafting readiness

The repository provides a strong, current implementation baseline for drafting. It establishes application data models, core flows, browser storage, retention selection, security controls and infrastructure configuration. It does not establish corporate facts, lawful bases, final controller/processor positions, provider contracts/transfers/retention, mailbox governance, commercial/legal positions or the complete operational offboarding/incident process.

**Recommendation: READY FOR LEGAL DRAFTING, subject to the prominently marked BUSINESS CONFIRMATION REQUIRED inputs.** Drafts should remain explicitly provisional until those owner and legal decisions are supplied.

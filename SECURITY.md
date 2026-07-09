# PrivacyReady Security & Compliance Architecture

This document outlines the security controls, automated scanning pipelines, and infrastructure-level protections implemented across the PrivacyReady platform to ensure GDPR compliance, data integrity, and high availability.

## 1. Secure Coding Practices

### SQL Injection (SQLi) Prevention
**Language:** TypeScript (Node.js) / Prisma ORM
We prevent SQL injection by strictly avoiding raw string concatenation. We exclusively use Prisma ORM, which automatically parameterizes all queries and escapes user input before it reaches the PostgreSQL database.

#### ❌ Before (Vulnerable to SQLi)
```typescript
// DANGEROUS: String concatenation allows an attacker to inject " OR 1=1 --"
const email = req.body.email;
const query = `SELECT * FROM User WHERE email = '${email}'`;
const user = await db.execute(query);
```

#### ✅ After (Secure with Prisma ORM)
```typescript
// SECURE: Prisma parameterizes the query automatically at the engine level
const email = req.body.email;
const user = await prisma.user.findUnique({
  where: { email: email }
});
```

### Cross-Site Scripting (XSS) Prevention
**Language:** TypeScript (React)
The PrivacyReady frontend is built in React. React natively escapes all variables embedded in JSX by converting them to string literals before rendering, automatically mitigating XSS. 
*Rule:* We strictly prohibit the use of `dangerouslySetInnerHTML` unless explicitly sanitized using `DOMPurify`.

### Command Injection Prevention
**Language:** Python
Our scanning microservices (Facebook, LINE, TikTok) use Python's native API requests libraries rather than system shell executions. Any required subprocess calls use `subprocess.run()` with explicitly passed list arguments (`shell=False`) to prevent OS-level command injection.

---

## 2. Infrastructure Security (AWS / Terraform)

*   **Encrypted Web Traffic:** All traffic is encrypted in transit using TLS 1.2/1.3 via AWS Certificate Manager (ACM) and CloudFront edge termination.
*   **DNS Security (DNSSEC):** Route53 is configured with DNSSEC signing, providing cryptographic proof of origin and preventing DNS spoofing or cache poisoning.
*   **Origin IP Obfuscation:** The Application Load Balancer (ALB) Security Groups are strictly bound to the AWS Managed Prefix List for CloudFront (`com.amazonaws.global.cloudfront.origin-facing`). Direct internet access to backend instances is completely blocked.
*   **DDoS & Bot Mitigation:** AWS WAFv2 is attached to the ALB, implementing Rate Limiting, Geo-Blocking (restricting non-authorized countries), and AWS Managed Bot Control to drop malicious scrapers.
*   **Secret Management:** No API keys are hardcoded in Terraform or Application Code. Secrets are injected at runtime via Environment Variables and CI/CD variables.

---

## 3. Automated Security Scanning (CI/CD)

Our GitLab CI/CD pipeline enforces the following automated security checks on every commit:

1.  **Dependencies (npm audit / Trivy):** Checks Node.js and Docker base images for known CVEs.
2.  **Tfsec:** Analyzes Terraform HCL files for cloud misconfigurations (e.g., publicly open S3 buckets).
3.  **Bandit & Safety:** Scans Python source code for insecure function calls and verifies Python dependency versions.
4.  **ShellCheck:** Analyzes Bash/Shell scripts for syntax errors and security loopholes (like missing quotes).
5.  **ESLint Security:** Uses `eslint-plugin-security` to identify risky regex or dangerous string evaluations in TypeScript/JavaScript.

---

## 4. Application Security

*   **Strong Authentication:** Passwords are mathematically hashed using `bcrypt` (cost factor 12). Registration enforces strong password complexity.
*   **Role-Based Access Control (RBAC):** Fastify routes are protected by a custom RBAC middleware that inspects JWT claims to ensure users can only access resources matching their organization ID and permission level (`ADMIN` vs `MEMBER`).
*   **Third-Party Scripts & GDPR Consent:** The React portal utilizes a Cookie Consent Banner to block invasive third-party tracking scripts until explicit user opt-in is granted.

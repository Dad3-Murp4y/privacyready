# AGENT INSTRUCTIONS

Set up Agent Toolkit for AWS by following instructions:
https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md

# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed execution, observability, and audit logging. If unavailable, use the AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available. Load the skill with `retrieve_skill` and prefer its guidance over general knowledge.
- When uncertain about specific AWS details (API parameters, permissions, limits, error codes), verify against documentation rather than guessing. State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework principles.
- Do not use em dashes in AWS resource names or descriptions. Use hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret, credential, API key, token, or password task. MUST NOT call `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST NOT hit the Secrets Manager Agent daemon directly. MUST use `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with `asm-exec` so the secret resolves at runtime without entering context.

# Product UI and Paywall Guidance

- Treat PrivacyReady as professional B2B compliance software: use light primary surfaces, deep navy navigation, restrained blue accents, generous whitespace, subtle borders and shadows, and minimal gradients.
- Use the shared design tokens and reusable portal components. Do not duplicate component styling or introduce page-specific visual systems without a clear need.
- Use `lucide-react` for interface icons. Do not use emoji as interface icons.
- Support keyboard navigation, visible focus states, reduced motion, and responsive layouts from 320px upward.
- Preserve real API-backed workflows. Never replace scanner, billing, authentication, DSR, or compliance data with simulated production behaviour.
- Backend authentication, authorization, tenant isolation, subscription checks, entitlements, and premium data filtering remain authoritative.
- Never grant premium access based only on routes, CSS, query parameters, or mutable client state. Frontend paywalls communicate and guide; they are not security boundaries.
- Never render sensitive premium data and rely on blur, clipping, or hidden styles as protection. The API must withhold or redact data the caller is not entitled to receive.
- Do not expose scanner credentials, private service hostnames, claim tokens in URLs, or backend secrets in browser code.

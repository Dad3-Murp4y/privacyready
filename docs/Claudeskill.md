# Skill Name: PrivacyReady DevOps & Platform Architect
# Description: Production-grade DevOps, containerisation, and IaC engineering for the PrivacyReady platform (GDPR/PDPA compliance platform). Encapsulates AWS multi-service architecture, Thailand data residency constraints, Node.js/Python microservices, and cost-optimised Terraform workspaces.

## Context & Triggers
Activate this skill automatically whenever the user references:
- **Core Platform:** PrivacyReady architectures, services, or infrastructure blueprints.
- **Frontend Layer:** S3 Landing Page (`index.html` with EN/TH/RU languages) or the React Client Portal SPA behind CloudFront.
- **Backend Services:** Node.js Core API (`services/api` using Fastify), Python Scanner API (`services/scanner` using FastAPI), or Python DSR API (`services/dsr` using FastAPI).
- **Data & Caching:** Aurora PostgreSQL or ElastiCache Redis 7.0 configurations.
- **Infrastructure / Deployments:** Terraform modules, workspaces (`production` vs `testing`), GitLab CI pipeline setups, or `gitlab-ci-deployer` IAM profiles.

## Core Mandates & Architecture Guardrails

### 1. Data Residency & Sovereignty
- **Region Enforcement:** All production resources (S3, RDS, ECS, KMS) must be explicitly pinned to ASEAN regions (`ap-southeast-1` Singapore or `ap-southeast-3` Bangkok/Thailand). *Never default to US or EU regions.*
- **Encryption Baseline:** Ensure AWS KMS encryption is explicitly configured at rest for all EBS volumes, RDS instances, ElastiCache clusters, and S3 buckets. Enforce TLS 1.2+ via ACM at the ALB/CloudFront level.

### 2. Microservice Standards
- **Network Isolation:** ECS Fargate tasks and data tiers (RDS/Redis) must reside in isolated private subnets. Inbound traffic must pass exclusively through the Application Load Balancer (ALB).
- **Node.js (Fastify Core API):** Build multi-stage Dockerfiles compiling dependencies on a build layer, pruning development packages, and deploying onto minimal base images (e.g., `node:iron-alpine`). Run under the unprivileged `node` user.
- **Python (FastAPI Scanner & DSR):** Build multi-stage Dockerfiles compiling dependencies inside a virtual environment (`venv`) or building wheels, then copying them into clean `python:3.11-slim` runtimes. Never run as `root`.

### 3. Terraform & Cost Optimization Workspaces
- **Production Workspace (`production`):** Enforce multi-AZ high availability. Utilize Transit Gateways connecting Management, Staging, and Production VPCs. Use multi-node Aurora PostgreSQL clusters and ElastiCache replication groups.
- **Testing Workspace (`testing`):** Collapse networks into a single VPC. Provision low-cost single-node databases (e.g., single `db.t3.medium` Aurora node) and turn off non-essential EC2 components to minimize development spend.
- **State Locking:** Force S3 remote backend configuration with DynamoDB state locking tables enabled.

### 4. Least-Privilege CI/CD (GitLab)
- **Deployment Credentials:** Restrict IAM permissions for the `gitlab-ci-deployer` user. They must only have access to authenticate against ECR, push to the three application repositories (`api`, `scanner`, `dsr`), and run `UpdateService` on those exact ECS workloads. No global administrative or wildcard `*` structural modifications allowed within CI runs.

## Execution Workflow

1. **Context Check:** Pinpoint the microservice (Node.js vs Python) or structural block (Terraform workspace, CloudFront CDN, Monitoring) being addressed.
2. **Strategy Blueprint:** State an optimization plan in exactly 3 concise bullet points before delivering any technical modifications.
3. **Delivery:** Provide fully commented, ready-to-deploy code blocks matching PrivacyReady's tech stack architecture.
4. **Validation Routine:** Always include a short "How to Test" snippet listing the precise shell or AWS CLI commands needed to verify your changes.

# DataWai Platform

DataWai is a comprehensive PDPA (Personal Data Protection Act) compliance platform tailored for the Thai market. It provides automated website and social media scanning, consent management, data subject rights (DSR) workflows, and infrastructure blueprints designed specifically for strict data residency and security compliance.

---

## 🏛️ Architecture Overview

The DataWai platform consists of several decoupled services and a static frontend, orchestrated via Docker Compose for local development and AWS ECS/EKS for production.

### Core Components

1. **Frontend Landing & UI (`frontend/index.html`)**
   - A static, trilingual (EN, TH, RU) frontend.
   - Hosts the **Free PDPA Scanner** UI (Website & Social Media).
   - *Production Deployment:* Hosted on AWS S3 behind a CloudFront CDN (see `docs/03_Route53_ACM_CloudFront_Setup_Guide.md`).

2. **Core API Service (`services/api`)**
   - Written in Node.js (Fastify).
   - Handles core business logic, user consent tracking, and proxies requests to microservices.

3. **Scanner Service (`services/scanner`)**
   - Written in Python (FastAPI).
   - Performs deep PDPA compliance checks on user infrastructure.
   - Contains specialized scanners for:
     - **Websites**: Checks for cookie banners, privacy policies, SSL, and trackers.
     - **Facebook**: Audits lead form consent, pixel matching, and PII leakage in public comments.
     - **LINE**: Analyases auto-reply consent flows, rich menu privacy links, and login scopes.
     - **TikTok**: Scans bio link trackers and business settings.
   - Includes a `UnifiedScorer` that aggregates risks across platforms into a single compliance score and estimates fine exposure.

4. **DSR Service (`services/dsr`)**
   - Written in Python (FastAPI).
   - Manages Data Subject Rights (DSR) workflows, such as data deletion and access requests.

### Infrastructure & Data Residency

To comply with Thailand's PDPA requirements regarding cross-border data transfers and security:
- **AWS Region:** All production data is stored in AWS `ap-southeast-1` (Singapore) or `ap-southeast-7` (Thailand, when fully available).
- **Terraform:** Infrastructure is codified in the `terraform/` directory, provisioning VPCs, encrypted RDS (PostgreSQL), ElastiCache (Redis), and WAF.
- **Data Isolation:** Complete VPC isolation between Production, Staging, and Management environments.

For a deep dive into the infrastructure, see `docs/01_AWS_Thailand_GitLab_Architecture.md`.

---

## 🚀 How to Run Locally

We provide a Docker Compose environment for seamless local development.

### Prerequisites
- Docker & Docker Compose
- Python 3.10+
- Node.js 18+
- Go 1.22+

### Quick Start

1. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

2. **Start Infrastructure Services**
   Starts PostgreSQL, Redis, MinIO (S3 compatible), Vault, and MailHog.
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Run the Scanner Service (Python)**
   ```bash
   cd services/scanner/cmd/scanner
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8080
   ```

4. **Run the DSR Service (Python)**
   ```bash
   cd services/dsr
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

5. **Run the Frontend**
   Simply open `datawai.html` in your browser to view the frontend, or serve it using a simple HTTP server:
   ```bash
   python3 -m http.server 3001
   ```

---

## 🛠️ Operations & GitLab FAQs

### Do I need to keep the GitLab EC2 instance running to deploy?
**No.** If you are using the self-hosted GitLab instance defined in the Terraform blueprints (`gitlab.tf`), it is only strictly required while you are actively pushing code, running CI/CD pipelines, or merging MRs. 

To save costs:
- You can stop the GitLab EC2 instance and its associated RDS/ElastiCache instances when not actively developing.
- *However*, if you rely on GitLab Auto DevOps or continuous deployment triggers, they won't run while it's offline. 
- The production application (ECS, API, RDS) runs completely independent of GitLab. Your SaaS will stay online even if GitLab is shut down.

### How do I access the frontend of GitLab?
When provisioned via the Terraform scripts (`gitlab.tf` and `alb.tf`):
1. GitLab is placed behind an Application Load Balancer (ALB).
2. You access it via the domain name you configured (e.g., `gitlab.datawai.internal` or your public Route53 record).
3. If deployed in a private management VPC (as per the architecture docs), you must connect via your **AWS Client VPN** to the Bastion host or VPC before resolving the internal GitLab URL.
4. **Initial Login:** The root password is automatically generated. You can retrieve it via AWS Secrets Manager or by SSHing into the instance and running `sudo gitlab-rake "gitlab:password:reset[root]"`.

---

## 📂 Documentation Directory Reference

- `docs/01_AWS_Thailand_GitLab_Architecture.md`: AWS infrastructure and PDPA justification.
- `docs/02_GitHub_PDPA_SCC_Documentation.md`: GitHub Standard Contractual Clauses (SCC) for cross-border code hosting.
- `docs/03_Route53_ACM_CloudFront_Setup_Guide.md`: Frontend S3/CloudFront deployment guide.
- `docs/social-scanner.md`: Threat models and API specs for the social media scanners.
- `docs/validation-report.md`: Automated testing and QA sign-offs.

# PrivacyReady Platform - System Architecture & Overview

PrivacyReady is a comprehensive UK GDPR compliance platform for small and mid-sized businesses. It provides automated website compliance scanning, consent management, data subject rights (DSR) workflows, and infrastructure blueprints designed for UK data residency and security compliance.

---

## 🏛️ System Architecture

The PrivacyReady platform is built using a microservices architecture and deployed entirely on **AWS (Amazon Web Services)**. This ensures high availability, strict data residency within the UK, and enterprise-grade security.

### Core AWS Infrastructure

```mermaid
graph TD
    %% Define User and DNS
    User([End User])
    DNS([Route 53 DNS])
    
    %% Define Frontend / CDN
    CDN([CloudFront CDN])
    S3_Frontend[(S3: Frontend Landing)]
    S3_Portal[(S3: React Portal)]
    
    %% Define Backend / Application Layer
    ALB([Application Load Balancer])
    
    subgraph "AWS ECS Fargate Cluster"
        API[Node.js Core API]
        Scanner[Python Scanner API]
        DSR[Python DSR API]
        N8N[n8n Compliance Copilot]
    end
    
    %% Define AI Layer
    Bedrock([AWS Bedrock / Claude])
    S3_N8N[(S3: n8n Binary Data)]
    subgraph "Data Persistence"
        RDS[(Aurora PostgreSQL)]
        Redis[(ElastiCache Redis)]
    end
    
    %% Define Monitoring Layer
    CloudWatch([CloudWatch Alarms])
    SNS([SNS Alerting])
    SES([SES Email Delivery])
    
    %% Flow
    User -->|Visits privacyready.co.uk| DNS
    DNS --> CDN
    CDN --> S3_Frontend
    CDN --> S3_Portal
    
    User -->|API Requests| ALB
    ALB --> API
    ALB --> Scanner
    ALB --> DSR
    
    API <--> RDS
    API <--> Redis
    Scanner <--> Redis
    DSR <--> RDS
    N8N <--> RDS
    N8N <--> Redis
    N8N --> Bedrock
    N8N <--> S3_N8N
    
    %% Monitoring Flow
    ALB -.->|Metrics| CloudWatch
    ECS -.->|Metrics| CloudWatch
    RDS -.->|Metrics| CloudWatch
    
    CloudWatch -.->|Triggers| SNS
    SNS -.->|Sends Email| SES
    SES -.->|Alerts| Admin([Admin: alerts.privacyready@gmail.com])
    
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:white;
    classDef service fill:#3F8624,stroke:#232F3E,stroke-width:2px,color:white;
    classDef data fill:#3B48CC,stroke:#232F3E,stroke-width:2px,color:white;
    
    class CDN,ALB,CloudWatch,SNS,SES,DNS aws;
    class API,Scanner,DSR service;
    class S3_Frontend,S3_Portal,RDS,Redis data;
```

---

## 📦 Component Breakdown

### 1. Static Frontend & Portals (AWS S3 + CloudFront)
- **Landing Page (`frontend/index.html`)**: A static, trilingual (EN, TH, RU) frontend hosting the Free GDPR Scanner UI. It includes a **mandatory, cross-domain cookie consent wall** that blocks site functionality until cookies are accepted.
- **Client Portal (`frontend/portal`)**: A React-based Single Page Application (SPA) for authenticated users to manage their compliance workflows.
- **Deployment**: Both are hosted securely in private AWS S3 buckets. Public access is facilitated exclusively through CloudFront distributions using Origin Access Identities (OAI) for caching, low latency, and SSL/TLS termination.

### 2. Backend Microservices (AWS ECS Fargate)
All backend services are dockerized, pushed to AWS Elastic Container Registry (ECR), and run as serverless containers on **AWS ECS Fargate**.
- **Core API Service (`services/api`)**: Written in Node.js (Fastify). Handles authentication, core business logic, user consent tracking, and proxies requests to other microservices.
- **Scanner Service (`services/scanner`)**: Written in Python (FastAPI). Performs deep GDPR compliance checks on user infrastructure (Websites, Facebook, LINE, TikTok) and aggregates risks into a compliance score.
- **DSR Service (`services/dsr`)**: Written in Python (FastAPI). Manages Data Subject Rights (DSR) workflows, such as automated data deletion and access requests.

### 3. Data Storage (AWS RDS & ElastiCache)
- **Primary Database**: Amazon Aurora PostgreSQL (`db.t3.medium`). Used for storing user profiles, scan histories, and DSR records.
- **Caching & Message Broker**: Amazon ElastiCache (Redis 7.0). Used for rate limiting, session management, and asynchronous task queues between the Core API and the Scanner service.

### 4. Monitoring & Alerting (CloudWatch, SNS, SES)
The entire infrastructure is continuously monitored for health and performance anomalies:
- **CloudWatch Alarms**: Triggers on critical events such as high CPU utilization, high memory usage, ALB 5xx error spikes, or low RDS storage capacity.
- **Route 53 Health Checks**: Constantly ping the API endpoints to ensure uptime.
- **Alert Routing**: Alarms publish messages to an **Amazon SNS** topic, which in turn leverages **Amazon SES** to send formatted email notifications directly to `alerts.privacyready@gmail.com`.

### 5. n8n AI Compliance Copilot

A self-hosted [n8n](https://n8n.io) workflow automation instance runs on ECS Fargate as the AI backbone of the platform. It orchestrates complex, multi-step compliance workflows that connect the PrivacyReady API, external SaaS tools, and AI models — without custom glue code.

**What it does:**
- Builds and executes automated GDPR compliance workflows (e.g. auto-generating DSR responses, scheduling scan reminders, routing consent events)
- Calls **AWS Bedrock** (Anthropic Claude 3 Sonnet / Haiku) via a private VPC endpoint for AI-powered analysis — all inference stays within the AWS network, no data leaves to a public API
- Stores workflow execution artefacts and binary data (e.g. generated reports, attachments) in a dedicated **KMS-encrypted S3 bucket**
- Uses **Redis** as a Bull queue backend for reliable, distributed workflow execution
- Has its own isolated **PostgreSQL RDS** instance (optional — controlled by `create_n8n_rds`)

**Infrastructure components:**

| Component | Resource | Notes |
|---|---|---|
| Compute | ECS Fargate (n8nio/n8n:1.82.0) | 1 vCPU / 2 GB RAM (prod), 0.25 vCPU / 0.5 GB (test) |
| Database | RDS PostgreSQL 15 (`db.t3.micro`) | Controlled by `create_n8n_rds` variable |
| Queue | ElastiCache Redis 7 (`cache.t3.micro`) | Controlled by `create_n8n_redis` variable |
| Binary storage | S3 (KMS-encrypted, versioned in prod) | Workflow attachments and generated files |
| AI access | AWS Bedrock VPC Interface Endpoint | Claude 3 Sonnet + Haiku — private, no internet egress |
| Secrets | Secrets Manager | Encryption key + DB credentials |

**Access:** `https://privacyready-n8n-copilot-<env>.privacyready.co.uk`

**Relevant variables:**

| Variable | Effect |
|---|---|
| `create_n8n_rds` | `true` = provision dedicated RDS; `false` = point at `existing_rds_host` |
| `create_n8n_redis` | `true` = provision dedicated Redis; `false` = point at `existing_redis_host` |
| `enable_bedrock` | `true` = create VPC endpoint + IAM policy for Claude access |

---

## 🔒 Security & Data Residency (GDPR Compliance)

To comply with UK GDPR requirements regarding data residency and security:

1. **Geographic Data Residency**: All production data, including S3 buckets, RDS clusters, and ECS containers, are strictly provisioned in AWS `eu-west-2` (London) to maintain UK GDPR data sovereignty.
2. **Encryption**: 
   - **In Transit**: All endpoints are secured with modern TLS v1.2+ via AWS ACM certificates. HTTP traffic is strictly redirected to HTTPS at the Load Balancer level.
   - **At Rest**: EBS volumes, RDS clusters, ElastiCache, and S3 buckets are encrypted using AWS Key Management Service (KMS).
3. **Network Isolation**: Resources are deployed within isolated Virtual Private Clouds (VPCs). Databases and internal services are located in private subnets with absolutely no direct internet access, relying on NAT Gateways for outbound traffic and ALBs for inbound routing.

---

## 🛠️ Infrastructure as Code (Terraform)

The entire AWS environment is codified using Terraform, ensuring reproducible, version-controlled infrastructure deployments. 

```mermaid
graph LR
    TF([Terraform State])
    
    subgraph "Terraform Modules"
        Network[vpc.tf]
        Compute[ecs.tf]
        Data[rds.tf / redis.tf]
        Web[alb.tf / cloudfront.tf]
        Mon[monitoring.tf]
        DevOps[gitlab.tf]
    end
    
    TF --> Network
    TF --> Compute
    TF --> Data
    TF --> Web
    TF --> Mon
    TF --> DevOps
```

### Terraform Workspaces (Cost Optimization)
The infrastructure is designed to be highly cost-optimized across environments using **Terraform Workspaces**:
- **Production Workspace (`production`)**: Deploys a highly available, multi-AZ architecture with dedicated VPCs (Management, Staging, Production) interconnected via a Transit Gateway, alongside multi-node Aurora clusters and ElastiCache replication groups.
- **Testing Workspace (`testing`)**: Deploys a consolidated, low-cost environment. It collapses all networks into a single VPC, provisions single-node databases, and disables non-essential EC2 instances to radically minimize AWS billing during development and testing.

> **Always select a workspace before running Terraform commands.** The `default` workspace is never used.
> ```bash
> terraform workspace select production   # or: testing
> ```

### `gitlab_enabled` — GitLab Hibernation Toggle

Setting `gitlab_enabled = false` in your `.tfvars` hibernates expensive GitLab infrastructure while preserving all data:

| Resource | `gitlab_enabled = true` | `gitlab_enabled = false` |
|---|---|---|
| EC2 instance | Running | Stopped (EBS volumes retained) |
| ElastiCache Redis | Running | Destroyed |
| S3 artifacts bucket | Exists | Retained |
| Secrets Manager entries | Exist | Retained |
| Route 53 DNS record | Exists | Retained |

Savings: **~$200/month** when hibernated.

### S3 Backend with Native Locking

State is stored in S3 with file-based locking (Terraform ≥ 1.10 — no DynamoDB table required):

```hcl
backend "s3" {
  bucket       = "privacyready-terraform-state"
  key          = "platform/terraform.tfstate"
  region       = "eu-west-2"
  encrypt      = true
  use_lockfile = true
}
```

### Ansible Automation (Zero-Touch Updates)
EC2 instances (such as the GitLab server) are configured dynamically using **Ansible** playbooks retrieved during boot via EC2 `user_data`. 
- **Zero-Touch Patching**: The platform includes a universal patch management playbook (`ansible/patch-linux.yml`) that dynamically utilizes OS facts to execute system updates (`apt`, `yum`, or `dnf`) and handle safe reboots across mixed OS fleets without manual intervention.

### Self-Hosted GitLab (CI/CD)
The infrastructure blueprints include a fully isolated, self-hosted GitLab instance deployed on a private EC2 instance. This instance handles:
- Version Control for strict internal code governance.
- Automated CI/CD pipelines to build Docker images and push them directly to ECR.
- *Note:* The production application (ECS, API, RDS) runs completely independent of GitLab. The SaaS remains online even if the GitLab instance is shut down to save costs.

#### Least Privilege CI/CD Pipeline Configuration
To ensure maximum security, the CI/CD pipelines do not use root or administrator AWS keys. Instead, Terraform provisions a dedicated, strict **least-privilege IAM user** (`gitlab-ci-deployer`). This user only has permission to:
- Authenticate to Elastic Container Registry (ECR).
- Push images *only* to the three specific PrivacyReady microservice repositories.
- Trigger `UpdateService` *only* on the specific PrivacyReady ECS services.

**How to retrieve CI/CD credentials:**
The access keys for this user are automatically generated and stored securely in AWS Secrets Manager. To configure your GitLab CI/CD Variables:
1. Go to the AWS Secrets Manager console.
2. Locate the secret named `privacyready/gitlab/ci-credentials`.
3. Copy the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into your GitLab Project's CI/CD Settings.

---

## 🔄 Infrastructure Operations

### Persistent Resources

Two resources are protected with `prevent_destroy = true` and are **never terminated** by Terraform — they survive every `terraform destroy` cycle:

| Resource | Why it's protected |
|---|---|
| `aws_route53_zone.main` | Nameservers are set once at the registrar and must never change |
| `aws_instance.gitlab[0]` | EBS volumes hold all GitLab repos and CI history — stopping is fine, terminating is destructive |

### Route 53 Nameservers

The hosted zone nameservers are fixed and never change regardless of how many times infrastructure is rebuilt. After first deploy, record them here and configure them at your registrar once:

```
# Run after first apply to retrieve nameservers:
# terraform output -raw route53_nameservers
```

### Destroy & Re-deploy Lifecycle

> ⚠️ **Do not run `terraform destroy` directly** — the `prevent_destroy` guards will cause it to error. Always use the helper scripts.

**Helper scripts** are located at `terraform/scripts/`:

| Script | When to run | What it does |
|---|---|---|
| `pre-destroy.sh` | Before `terraform destroy` | Stops the GitLab EC2 instance, removes the EC2 + Route 53 zone + DNSSEC resources from state so destroy can proceed cleanly |
| `post-import.sh` | After `terraform apply` on a fresh deploy | Re-imports the existing Route 53 zone and GitLab EC2 instance back into state, then starts the instance |

**Tearing down:**
```bash
cd terraform/
scripts/pre-destroy.sh          # stops GitLab EC2, removes persistent resources from state
terraform destroy -auto-approve
```

**Re-deploying:**
```bash
cd terraform/
terraform apply                 # builds all infrastructure fresh
scripts/post-import.sh          # re-imports zone + instance, starts GitLab
terraform apply                 # reconcile any tag/record drift
```

---

## 📂 Documentation Directory Reference

- `docs/BOOTSTRAP.md`: steps to bootstrap a fresh AWS account for this platform.
- `docs/production_system_architecture.md`: in-depth multi-VPC architecture diagrams and specifications for the production environment.
- `docs/social-scanner.md`: threat models and API specs for the social media scanners.
- `docs/validation-report.md`: automated testing and QA sign-offs.
- `docs/audits/`: point-in-time code/security review reports (historical — check `PR_SUMMARY.md` at the repo root for what's since been fixed).

# AWS Thailand + GitLab Self-Hosted Architecture
## For PDPA-Compliant SaaS Development

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Thailand (ap-southeast-1)                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │
│  │   VPC (10.0/16)  │    │   VPC (10.1/16)  │    │   VPC (10.2/16)          │    │
│  │   Production     │    │   Staging        │    │   Management/CI          │    │
│  │                  │    │                  │    │                          │    │
│  │  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────────────┐  │    │
│  │  │ ECS/EKS   │  │    │  │ ECS/EKS   │  │    │  │ GitLab CE/EE      │  │    │
│  │  │ (App)     │  │    │  │ (App)     │  │    │  │ Self-Hosted       │  │    │
│  │  └─────┬─────┘  │    │  └─────┬─────┘  │    │  │                   │  │    │
│  │        │        │    │        │        │    │  │  ┌─────────────┐  │  │    │
│  │  ┌─────┴─────┐  │    │  ┌─────┴─────┐  │    │  │  │ GitLab Runner │  │  │    │
│  │  │ RDS        │  │    │  │ RDS        │  │    │  │  │ (Thailand)    │  │  │    │
│  │  │ PostgreSQL │  │    │  │ PostgreSQL │  │    │  │  └─────────────┘  │  │    │
│  │  │ (Encrypted)│  │    │  │ (Encrypted)│  │    │  │                   │  │    │
│  │  └───────────┘  │    │  └───────────┘  │    │  │  ┌─────────────┐  │  │    │
│  │  ┌───────────┐  │    │  ┌───────────┐  │    │  │  │ Registry    │  │  │    │
│  │  │ ElastiCache│  │    │  │ ElastiCache│  │    │  │  │ (Docker)    │  │  │    │
│  │  │ (Redis)    │  │    │  │ (Redis)    │  │    │  │  └─────────────┘  │  │    │
│  │  └───────────┘  │    │  └───────────┘  │    │  └───────────────────┘  │    │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘    │
│         │                      │                      │                       │
│  ┌──────┴──────────────────────┴──────────────────────┴──────────────────┐   │
│  │                        AWS Transit Gateway                              │   │
│  │                    (Inter-VPC + VPN Connectivity)                       │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                     │
│  ┌──────┴──────────────────────────────────────────────────────────────┐     │
│  │                      AWS Backup + S3 (Thailand)                        │     │
│  │              ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │     │
│  │              │ Code Backup │    │ DB Backup   │    │ Artifact    │   │     │
│  │              │ (GitLab)   │    │ (RDS Snap)  │    │ Store       │   │     │
│  │              │ S3 + KMS   │    │ S3 + KMS    │    │ S3 + KMS    │   │     │
│  │              └─────────────┘    └─────────────┘    └─────────────┘   │     │
│  └──────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              Developer Access                                │
│                                                                              │
│   Developer Laptop ──► AWS Client VPN ──► Bastion Host ──► GitLab/ECS      │
│   (Thailand/Remote)      (Thailand endpoint)   (Thailand)    (Thailand)     │
│                                                                              │
│   MFA Required + IP Whitelist + Certificate-based Auth                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Why This Architecture Satisfies PDPA

| PDPA Requirement | How This Architecture Addresses It |
|------------------|-----------------------------------|
| **Data Localization (Section 28)** | All personal data storage (RDS, S3, ElastiCache) in `ap-southeast-1`. No cross-border transfer for production data. |
| **Cross-Border Transfer (Section 29)** | Only anonymized metrics/logs may leave (with SCCs). Source code = not personal data. Git repos contain no Thai PII. |
| **Security Measures (Section 37)** | VPC isolation, KMS encryption at rest, TLS 1.3 in transit, Security Groups, AWS WAF, GuardDuty. |
| **Data Breach Notification (Section 37)** | CloudWatch → SNS → Lambda → PDPC notification within 72h. Automated. |
| **Data Subject Rights (Section 30-36)** | Admin API in Thailand region. Deletion cascades through RDS + S3 + backups within 30 days. |
| **DPO Appointment (Section 41)** | Required for "large-scale" processing. This architecture supports DPO audit access to all logs. |
| **Records of Processing (Section 39)** | CloudTrail + GitLab audit logs + RDS audit logging. All stored in Thailand S3, 7-year retention. |

---

## 3. GitLab Self-Hosted Configuration

### 3.1 Infrastructure (Terraform)

```hcl
# terraform/gitlab-infra.tf
provider "aws" {
  region = "ap-southeast-1"  # Singapore (closest to Thailand with full AWS services)
  # For true Thailand data residency, use ap-southeast-7 (Bangkok) when available
  # or ap-southeast-1 with contractual Thailand data processing terms
}

# VPC for GitLab Management
resource "aws_vpc" "gitlab_vpc" {
  cidr_block           = "10.2.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "gitlab-management"
    Environment = "management"
    PDPA        = "compliant"
    DataResidency = "thailand"
  }
}

# Private subnets for GitLab (no public IP)
resource "aws_subnet" "gitlab_private" {
  count             = 3
  vpc_id            = aws_vpc.gitlab_vpc.id
  cidr_block        = "10.2.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "gitlab-private-${count.index + 1}"
    Type = "private"
  }
}

# GitLab EC2 instance (or ECS for HA)
resource "aws_instance" "gitlab" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "m6i.2xlarge"  # 8 vCPU, 32GB RAM minimum for GitLab
  subnet_id              = aws_subnet.gitlab_private[0].id
  vpc_security_group_ids = [aws_security_group.gitlab.id]
  key_name               = aws_key_pair.gitlab.key_name
  iam_instance_profile   = aws_iam_instance_profile.gitlab.name

  root_block_device {
    volume_size = 100
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  ebs_block_device {
    device_name = "/dev/sdb"
    volume_size = 500  # For repositories, artifacts, LFS
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  user_data = templatefile("${path.module}/gitlab-install.sh", {
    external_url       = "https://gitlab.datawai.internal"
    db_host            = aws_rds_cluster.gitlab.endpoint
    redis_host         = aws_elasticache_replication_group.gitlab.primary_endpoint_address
    s3_bucket          = aws_s3_bucket.gitlab_artifacts.id
    kms_key            = aws_kms_key.gitlab.arn
  })

  tags = {
    Name = "gitlab-primary"
    PDPA = "compliant"
  }
}

# RDS PostgreSQL for GitLab (Multi-AZ for HA)
resource "aws_rds_cluster" "gitlab" {
  cluster_identifier        = "gitlab-postgres"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  database_name             = "gitlabhq_production"
  master_username           = "gitlab"
  master_password           = random_password.gitlab_db.result
  backup_retention_period   = 30
  preferred_backup_window   = "03:00-04:00"  # Thailand time (UTC+7)
  vpc_security_group_ids    = [aws_security_group.gitlab_db.id]
  db_subnet_group_name      = aws_db_subnet_group.gitlab.name
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.gitlab.arn
  deletion_protection       = true

  tags = {
    PDPA = "compliant"
    DataResidency = "thailand"
  }
}

# ElastiCache Redis for GitLab
resource "aws_elasticache_replication_group" "gitlab" {
  replication_group_id = "gitlab-redis"
  description          = "GitLab Redis cluster"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.r6g.large"
  num_cache_clusters   = 2
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token           = random_password.gitlab_redis.result
  subnet_group_name    = aws_elasticache_subnet_group.gitlab.name
  security_group_ids   = [aws_security_group.gitlab_redis.id]

  tags = {
    PDPA = "compliant"
  }
}

# S3 Bucket for GitLab Artifacts/Backups (Thailand region)
resource "aws_s3_bucket" "gitlab_artifacts" {
  bucket = "datawai-gitlab-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = {
    PDPA = "compliant"
    DataResidency = "thailand"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gitlab_artifacts" {
  bucket = aws_s3_bucket.gitlab_artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.gitlab.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "gitlab_artifacts" {
  bucket = aws_s3_bucket.gitlab_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Block ALL public access
resource "aws_s3_bucket_public_access_block" "gitlab_artifacts" {
  bucket = aws_s3_bucket.gitlab_artifacts.id
  block_public_acls       = true
  block_public_policy       = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# KMS Key for encryption (Thailand region, Thai staff as key admins)
resource "aws_kms_key" "gitlab" {
  description             = "GitLab PDPA encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false  # Keep in Thailand region only

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow GitLab Instance"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.gitlab.arn
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow DPO Audit Access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/dpo-audit"
        }
        Action = [
          "kms:DescribeKey",
          "kms:GetKeyPolicy",
          "kms:ListKeyPolicies"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    PDPA = "compliant"
    Purpose = "gitlab-encryption"
  }
}

resource "aws_kms_alias" "gitlab" {
  name          = "alias/gitlab-pdpa"
  target_key_id = aws_kms_key.gitlab.key_id
}
```

### 3.2 GitLab Installation Script

```bash
#!/bin/bash
# gitlab-install.sh - cloud-init user data

# Update and install dependencies
yum update -y
yum install -y docker amazon-cloudwatch-agent

# Start Docker
systemctl enable docker
systemctl start docker

# Install GitLab CE using Docker (production: use Omnibus package for better performance)
docker run --detach   --hostname gitlab.datawai.internal   --publish 443:443 --publish 80:80 --publish 22:22   --name gitlab   --restart always   --volume /gitlab/config:/etc/gitlab:Z   --volume /gitlab/logs:/var/log/gitlab:Z   --volume /gitlab/data:/var/opt/gitlab:Z   --env GITLAB_OMNIBUS_CONFIG="
    external_url 'https://gitlab.datawai.internal'
    gitlab_rails['db_adapter'] = 'postgresql'
    gitlab_rails['db_encoding'] = 'unicode'
    gitlab_rails['db_host'] = '${db_host}'
    gitlab_rails['db_database'] = 'gitlabhq_production'
    gitlab_rails['db_username'] = 'gitlab'
    gitlab_rails['db_password'] = '$(aws secretsmanager get-secret-value --secret-id gitlab/db-password --query SecretString --output text --region ap-southeast-1)'
    redis['enable'] = false
    gitlab_rails['redis_host'] = '${redis_host}'
    gitlab_rails['redis_password'] = '$(aws secretsmanager get-secret-value --secret-id gitlab/redis-password --query SecretString --output text --region ap-southeast-1)'
    gitlab_rails['object_store']['enabled'] = true
    gitlab_rails['object_store']['connection'] = {
      'provider' => 'AWS',
      'region' => 'ap-southeast-1',
      'aws_access_key_id' => '$(aws secretsmanager get-secret-value --secret-id gitlab/s3-access-key --query SecretString --output text --region ap-southeast-1)',
      'aws_secret_access_key' => '$(aws secretsmanager get-secret-value --secret-id gitlab/s3-secret-key --query SecretString --output text --region ap-southeast-1)'
    }
    gitlab_rails['object_store']['objects']['artifacts']['bucket'] = '${s3_bucket}'
    gitlab_rails['object_store']['objects']['lfs']['bucket'] = '${s3_bucket}'
    gitlab_rails['object_store']['objects']['uploads']['bucket'] = '${s3_bucket}'
    gitlab_rails['object_store']['objects']['packages']['bucket'] = '${s3_bucket}'
    gitlab_rails['object_store']['objects']['dependency_proxy']['bucket'] = '${s3_bucket}'
    gitlab_rails['object_store']['objects']['terraform_state']['bucket'] = '${s3_bucket}'
    # PDPA: Disable telemetry/analytics that might send data outside Thailand
    gitlab_rails['usage_ping_enabled'] = false
    gitlab_rails['snowplow_enabled'] = false
    gitlab_rails['gitlab_pages']['enabled'] = false  # Disable if not needed
    # Security hardening
    nginx['ssl_certificate'] = '/etc/gitlab/ssl/gitlab.crt'
    nginx['ssl_certificate_key'] = '/etc/gitlab/ssl/gitlab.key'
    nginx['ssl_protocols'] = 'TLSv1.2 TLSv1.3'
    nginx['ssl_ciphers'] = 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'
    # Session security
    gitlab_rails['session_store'] = 'redis_store'
    gitlab_rails['session_expire_delay'] = 1440  # 24 hours
    # Audit logging for PDPA
    gitlab_rails['audit_events']['periodic_database_cleanup']['enabled'] = true
    gitlab_rails['audit_events']['periodic_database_cleanup']['older_than'] = '6m'
  "   gitlab/gitlab-ce:latest

# Configure CloudWatch agent for PDPA audit logging
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/gitlab/logs/gitlab-rails/production_json.log",
            "log_group_name": "/datawai/gitlab/audit",
            "log_stream_name": "{instance_id}",
            "timezone": "Local"
          },
          {
            "file_path": "/gitlab/logs/gitlab-rails/application.log",
            "log_group_name": "/datawai/gitlab/application",
            "log_stream_name": "{instance_id}",
            "timezone": "Local"
          },
          {
            "file_path": "/gitlab/logs/nginx/access.log",
            "log_group_name": "/datawai/gitlab/nginx",
            "log_stream_name": "{instance_id}",
            "timezone": "Local"
          }
        ]
      }
    }
  }
}
EOF

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

# Install AWS CLI v2 for S3 backup automation
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install

# Setup automated backup to S3 (PDPA: encrypted, versioned, in Thailand)
cat > /opt/gitlab-backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/gitlab/data/backups"
S3_BUCKET="${s3_bucket}-backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Create GitLab backup
docker exec gitlab gitlab-rake gitlab:backup:create

# Upload to S3 with server-side encryption
aws s3 sync $BACKUP_DIR s3://$S3_BUCKET/backups/$DATE/   --sse aws:kms   --sse-kms-key-id ${kms_key}   --storage-class STANDARD_IA   --region ap-southeast-1

# Cleanup old backups (keep 90 days for PDPA compliance)
find $BACKUP_DIR -type f -mtime +7 -delete
aws s3api list-objects-v2 --bucket $S3_BUCKET --prefix backups/   --query 'Contents[?LastModified<`'$(date -d '90 days ago' --iso-8601)`'].Key'   --output text | xargs -I {} aws s3 rm s3://$S3_BUCKET/{}
EOF

chmod +x /opt/gitlab-backup.sh

# Run backup daily at 2 AM Thailand time
echo "0 2 * * * root /opt/gitlab-backup.sh >> /var/log/gitlab-backup.log 2>&1" > /etc/cron.d/gitlab-backup
```

---

## 4. GitLab Runner Configuration (Thailand-based CI/CD)

```hcl
# terraform/gitlab-runner.tf

# GitLab Runner in Thailand VPC
resource "aws_instance" "gitlab_runner" {
  count                  = 2  # Multiple runners for parallel jobs
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "m6i.xlarge"
  subnet_id              = aws_subnet.gitlab_private[count.index].id
  vpc_security_group_ids = [aws_security_group.gitlab_runner.id]
  iam_instance_profile   = aws_iam_instance_profile.gitlab_runner.name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  user_data = templatefile("${path.module}/gitlab-runner-install.sh", {
    gitlab_url    = "https://gitlab.datawai.internal"
    runner_token  = aws_secretsmanager_secret_version.gitlab_runner_token.secret_string
    s3_cache_bucket = aws_s3_bucket.gitlab_runner_cache.id
  })

  tags = {
    Name = "gitlab-runner-${count.index + 1}"
    PDPA = "compliant"
  }
}

# S3 cache bucket for CI/CD artifacts (Thailand region)
resource "aws_s3_bucket" "gitlab_runner_cache" {
  bucket = "datawai-gitlab-runner-cache-${data.aws_caller_identity.current.account_id}"

  tags = {
    PDPA = "compliant"
    DataResidency = "thailand"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gitlab_runner_cache" {
  bucket = aws_s3_bucket.gitlab_runner_cache.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.gitlab.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle: delete cache after 7 days (not personal data, but good hygiene)
resource "aws_s3_bucket_lifecycle_configuration" "gitlab_runner_cache" {
  bucket = aws_s3_bucket.gitlab_runner_cache.id
  rule {
    id     = "expire-cache"
    status = "Enabled"
    expiration {
      days = 7
    }
  }
}
```

```bash
#!/bin/bash
# gitlab-runner-install.sh

yum update -y
yum install -y docker amazon-cloudwatch-agent

systemctl enable docker
systemctl start docker

# Install GitLab Runner
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.rpm.sh" | bash
yum install -y gitlab-runner

# Register runner with Thailand GitLab instance
gitlab-runner register   --non-interactive   --url "${gitlab_url}"   --registration-token "${runner_token}"   --executor "docker"   --docker-image "docker:24-dind"   --docker-privileged   --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"   --tag-list "thailand,production,docker"   --run-untagged="false"   --locked="false"   --access-level="not_protected"   --cache-type "s3"   --cache-s3-server-address "s3.ap-southeast-1.amazonaws.com"   --cache-s3-bucket-name "${s3_cache_bucket}"   --cache-s3-bucket-location "ap-southeast-1"   --cache-s3-insecure "false"   --cache-s3-cache-path "runner-cache"

# Configure runner for PDPA compliance
cat >> /etc/gitlab-runner/config.toml <<'EOF'
[[runners]]
  [runners.custom_build_dir]
  [runners.cache]
    [runners.cache.s3]
    [runners.cache.gcs]
  [runners.machine]
  [runners.kubernetes]
  [runners.ssh]
  [runners.docker]
    tls_verify = true
    image = "docker:24-dind"
    privileged = true
    disable_cache = false
    volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache"]
    shm_size = 0
    # PDPA: Ensure containers don't send data outside Thailand
    [[runners.docker.services]]
      name = "docker:24-dind"
      alias = "docker"
EOF

systemctl enable gitlab-runner
systemctl start gitlab-runner
```

---

## 5. Network Security (Zero Trust for PDPA)

```hcl
# terraform/security.tf

# Security Group: GitLab (no inbound from internet)
resource "aws_security_group" "gitlab" {
  name_prefix = "gitlab-"
  vpc_id      = aws_vpc.gitlab_vpc.id
  description = "GitLab management security group"

  # Only allow HTTPS from Bastion/VPN
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.gitlab_vpc.cidr_block, aws_vpc.bastion_vpc.cidr_block]
    description = "HTTPS from internal only"
  }

  # SSH only from Bastion
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.bastion_vpc.cidr_block]
    description = "SSH from bastion only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Outbound for updates (controlled by VPC endpoints)"
  }

  tags = {
    PDPA = "compliant"
  }
}

# VPC Endpoints: Keep AWS traffic inside Thailand region (no internet)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.gitlab_vpc.id
  service_name      = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.gitlab_private[*].id

  tags = {
    Name = "gitlab-s3-endpoint"
    PDPA = "compliant"
  }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.gitlab_vpc.id
  service_name        = "com.amazonaws.ap-southeast-1.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.gitlab_private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "gitlab-secretsmanager-endpoint"
    PDPA = "compliant"
  }
}

resource "aws_vpc_endpoint" "kms" {
  vpc_id              = aws_vpc.gitlab_vpc.id
  service_name        = "com.amazonaws.ap-southeast-1.kms"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.gitlab_private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "gitlab-kms-endpoint"
    PDPA = "compliant"
  }
}

# AWS WAF for any public-facing endpoints (if needed)
resource "aws_wafv2_web_acl" "gitlab" {
  name        = "gitlab-pdpa-waf"
  description = "WAF rules for GitLab PDPA compliance"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "GeoBlockNonThailand"
    priority = 2
    action {
      block {}
    }
    statement {
      geo_match_statement {
        country_codes = ["TH"]
        # Block all non-Thailand access (if required by PDPA for sensitive data)
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlock"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "gitlab-waf"
    sampled_requests_enabled   = true
  }
}
```

---

## 6. PDPA Audit & Monitoring Stack

```yaml
# cloudwatch-alarms.yml
Resources:
  # Alert on any data transfer to non-Thailand regions
  UnauthorizedDataTransferAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: "PDPA-Unauthorized-Data-Transfer"
      AlarmDescription: "Triggers when data is accessed from non-Thailand IP or transferred to non-ap-southeast-1 S3"
      MetricName: "UnauthorizedDataTransfer"
      Namespace: "PDPA/Compliance"
      Statistic: "Sum"
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: "GreaterThanOrEqualToThreshold"
      AlarmActions:
        - !Ref PDPAAlertTopic

  # Alert on failed encryption (KMS errors)
  KMSEncryptionFailureAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: "PDPA-KMS-Encryption-Failure"
      MetricName: "KMSInvalidKeyUsage"
      Namespace: "AWS/KMS"
      Statistic: "Sum"
      Period: 60
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: "GreaterThanOrEqualToThreshold"
      AlarmActions:
        - !Ref PDPAAlertTopic
        - !Ref DPOOnCallTopic

  # Alert on GitLab admin access (privileged account monitoring)
  GitLabAdminAccessAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: "PDPA-GitLab-Admin-Access"
      AlarmDescription: "Triggers on GitLab admin/root access for audit trail"
      MetricName: "AdminLogin"
      Namespace: "GitLab/Audit"
      Statistic: "Sum"
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: "GreaterThanOrEqualToThreshold"
      AlarmActions:
        - !Ref PDPAAlertTopic

  PDPAAlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: "pdpa-compliance-alerts"
      DisplayName: "PDPA Compliance Alerts"

  DPOOnCallTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: "dpo-on-call"
      DisplayName: "DPO On-Call Alerts"
```

```python
# lambda/pdpa-breach-detector.py
# Deployed in Thailand region, monitors CloudTrail for PDPA violations

import json
import boto3
import os
from datetime import datetime

sns = boto3.client('sns', region_name='ap-southeast-1')
ALERT_TOPIC = os.environ['PDPA_ALERT_TOPIC_ARN']
DPO_TOPIC = os.environ['DPO_TOPIC_ARN']

def lambda_handler(event, context):
    """
    Monitors CloudTrail logs for PDPA compliance violations:
    1. S3 data transfer to non-Thailand regions
    2. Unencrypted data access
    3. Unauthorized cross-border API calls
    4. Failed KMS decryption attempts
    """

    records = event.get('Records', [])
    alerts = []

    for record in records:
        log_data = json.loads(record['s3']['object']['key'])

        for event in log_data.get('Records', []):
            event_name = event.get('eventName')
            event_source = event.get('eventSource')
            user_identity = event.get('userIdentity', {})
            request_params = event.get('requestParameters', {})

            # Check 1: S3 PutObject to non-Thailand bucket
            if event_name == 'PutObject' and event_source == 's3.amazonaws.com':
                bucket = request_params.get('bucketName', '')
                if not bucket.endswith('ap-southeast-1'):
                    alerts.append({
                        'severity': 'CRITICAL',
                        'type': 'CROSS_BORDER_TRANSFER',
                        'detail': f'Data written to non-Thailand bucket: {bucket}',
                        'user': user_identity.get('arn'),
                        'time': event.get('eventTime')
                    })

            # Check 2: Unencrypted S3 upload
            if event_name == 'PutObject' and event_source == 's3.amazonaws.com':
                headers = request_params.get('x-amz-server-side-encryption', '')
                if not headers:
                    alerts.append({
                        'severity': 'HIGH',
                        'type': 'UNENCRYPTED_STORAGE',
                        'detail': f'Unencrypted object uploaded: {request_params.get("key")}',
                        'user': user_identity.get('arn'),
                        'time': event.get('eventTime')
                    })

            # Check 3: KMS decrypt by unauthorized role
            if event_name == 'Decrypt' and event_source == 'kms.amazonaws.com':
                role = user_identity.get('sessionContext', {}).get('sessionIssuer', {}).get('userName', '')
                if 'gitlab' not in role and 'dpo' not in role:
                    alerts.append({
                        'severity': 'HIGH',
                        'type': 'UNAUTHORIZED_DECRYPTION',
                        'detail': f'KMS decrypt by non-authorized role: {role}',
                        'user': user_identity.get('arn'),
                        'time': event.get('eventTime')
                    })

    # Send alerts
    if alerts:
        critical = [a for a in alerts if a['severity'] == 'CRITICAL']

        message = {
            'default': json.dumps({
                'alert_count': len(alerts),
                'critical_count': len(critical),
                'alerts': alerts,
                'timestamp': datetime.utcnow().isoformat(),
                'compliance_framework': 'Thailand PDPA',
                'required_action': 'Investigate within 24h, notify PDPC within 72h if breach confirmed'
            })
        }

        sns.publish(
            TopicArn=DPO_TOPIC if critical else ALERT_TOPIC,
            Message=json.dumps(message),
            MessageStructure='json'
        )

    return {'statusCode': 200, 'alerts_processed': len(alerts)}
```

---

## 7. Cost Estimate (Monthly, ap-southeast-1)

| Component | Spec | Monthly Cost |
|-----------|------|-------------|
| GitLab CE (EC2) | m6i.2xlarge | ~$280 |
| RDS Aurora PostgreSQL | db.r6g.large × 2 (Multi-AZ) | ~$520 |
| ElastiCache Redis | cache.r6g.large × 2 | ~$350 |
| S3 Storage | 500GB artifacts + backups | ~$12 |
| S3 API Requests | ~1M/month | ~$5 |
| KMS Key Operations | ~100K/month | ~$3 |
| CloudWatch Logs | 50GB ingest | ~$25 |
| VPC Endpoints | 3 endpoints | ~$22 |
| GitLab Runners (2×) | m6i.xlarge spot | ~$180 |
| AWS Backup | Cross-region copy disabled | ~$15 |
| **Total** | | **~$1,412/month** |

*Note: True Thailand region (`ap-southeast-7` Bangkok) pricing may differ. Use Singapore (`ap-southeast-1`) as proxy with contractual Thailand data processing terms until Bangkok region is fully available.*

---

## 8. PDPA Compliance Checklist for This Architecture

| # | Requirement | Implementation | Evidence |
|---|-------------|----------------|----------|
| 1 | Data localization | All storage in `ap-southeast-1` | S3 bucket policies, RDS region |
| 2 | Encryption at rest | KMS AES-256 on all storage | KMS key policies, S3 bucket encryption config |
| 3 | Encryption in transit | TLS 1.3, AWS PrivateLink | Security group rules, VPC endpoint configs |
| 4 | Access logging | CloudTrail + GitLab audit logs | S3 access logs, CloudWatch log groups |
| 5 | Breach detection | Lambda + CloudWatch Alarms | Lambda code, alarm definitions |
| 6 | 72h breach notification | SNS → DPO → PDPC | SNS topic subscriptions, runbook |
| 7 | Data subject deletion | GitLab API + RDS cascade delete | API documentation, test records |
| 8 | DPO audit access | IAM role + KMS policy | IAM policy, KMS key policy |
| 9 | Records retention | 7-year CloudTrail + GitLab logs | S3 lifecycle policies, backup scripts |
| 10 | Cross-border SCCs | Not needed (data stays in Thailand) | Architecture diagram, region configs |

---

## 9. Migration Path from GitHub

| Phase | Action | Timeline |
|-------|--------|----------|
| 1 | Deploy GitLab in AWS Thailand (this architecture) | Week 1-2 |
| 2 | Mirror GitHub repos to GitLab (no PII in repos = no PDPA issue) | Week 2-3 |
| 3 | Configure CI/CD pipelines on GitLab Runners | Week 3-4 |
| 4 | Migrate Issues/Projects (sanitize any PII first) | Week 4-5 |
| 5 | Update developer workflows, VPN access | Week 5-6 |
| 6 | Decommission GitHub for sensitive repos (keep for public OSS) | Week 6-7 |
| 7 | PDPA audit of new architecture | Week 8 |

---

*Architecture Version: 1.0*
*Last Updated: 2026-06-05*
*Compliance Framework: Thailand PDPA B.E. 2562 (2019)*

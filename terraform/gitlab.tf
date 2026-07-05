# Self-hosted GitLab server instance, Aurora PostgreSQL DB cluster, Redis Replication Group, and S3 artifact storage configurations
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "tls_private_key" "gitlab" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "gitlab" {
  key_name   = "datawai-gitlab-key"
  public_key = tls_private_key.gitlab.public_key_openssh
}

resource "aws_instance" "gitlab" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "m6i.2xlarge"  # 8 vCPU, 32GB RAM minimum for GitLab
  subnet_id              = aws_subnet.management_private[0].id
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

  user_data = <<USERDATA
#!/bin/bash
# Install dependencies
yum update -y
yum install -y docker amazon-cloudwatch-agent unzip
systemctl enable docker
systemctl start docker
# Download AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
USERDATA

  tags = {
    Name = "datawai-gitlab-primary"
    PDPA = "compliant"
  }
}

resource "aws_db_subnet_group" "gitlab" {
  name       = "datawai-gitlab-db-subnet"
  subnet_ids = aws_subnet.management_private[*].id
  tags       = { Name = "datawai-gitlab-db-subnet" }
}

resource "aws_rds_cluster" "gitlab" {
  cluster_identifier        = "datawai-gitlab-postgres"
  engine                    = "aurora-postgresql"
  engine_version            = "15.13"
  database_name             = "gitlabhq_production"
  master_username           = "gitlab"
  master_password           = random_password.gitlab_db.result
  backup_retention_period   = 30
  preferred_backup_window   = "03:00-04:00"  # Thailand time (UTC+7)
  vpc_security_group_ids    = [aws_security_group.gitlab_db.id]
  db_subnet_group_name      = aws_db_subnet_group.gitlab.name
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.gitlab.arn
  deletion_protection       = false
  skip_final_snapshot       = true

  tags = {
    PDPA          = "compliant"
    DataResidency = "thailand"
  }
}

resource "aws_rds_cluster_instance" "gitlab" {
  count              = 2
  identifier         = "datawai-gitlab-db-instance-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.gitlab.id
  instance_class     = "db.r6g.large"
  engine             = aws_rds_cluster.gitlab.engine
  engine_version     = aws_rds_cluster.gitlab.engine_version
}

resource "aws_elasticache_subnet_group" "gitlab" {
  name       = "datawai-gitlab-cache-subnet"
  subnet_ids = aws_subnet.management_private[*].id
}

resource "aws_elasticache_replication_group" "gitlab" {
  replication_group_id       = "datawai-gitlab-redis"
  description                = "GitLab Redis cluster"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.gitlab_redis.result
  subnet_group_name          = aws_elasticache_subnet_group.gitlab.name
  security_group_ids         = [aws_security_group.gitlab_redis.id]

  tags = {
    PDPA = "compliant"
  }
}

resource "aws_s3_bucket" "gitlab_artifacts" {
  bucket = "datawai-gitlab-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = {
    PDPA          = "compliant"
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

resource "aws_s3_bucket_public_access_block" "gitlab_artifacts" {
  bucket = aws_s3_bucket.gitlab_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "gitlab" {
  description             = "GitLab PDPA encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

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
      }
    ]
  })

  tags = {
    PDPA    = "compliant"
    Purpose = "gitlab-encryption"
  }
}

resource "aws_kms_alias" "gitlab" {
  name          = "alias/datawai-gitlab-pdpa"
  target_key_id = aws_kms_key.gitlab.key_id
}

resource "random_password" "gitlab_db" {
  length  = 32
  special = false
}

resource "random_password" "gitlab_redis" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "gitlab_db_password" {
  name                    = "datawai/gitlab/db-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_db_password" {
  secret_id     = aws_secretsmanager_secret.gitlab_db_password.id
  secret_string = random_password.gitlab_db.result
}

resource "aws_secretsmanager_secret" "gitlab_redis_password" {
  name                    = "datawai/gitlab/redis-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_redis_password" {
  secret_id     = aws_secretsmanager_secret.gitlab_redis_password.id
  secret_string = random_password.gitlab_redis.result
}

resource "aws_iam_role" "gitlab" {
  name = "datawai-gitlab-primary-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_instance_profile" "gitlab" {
  name = "datawai-gitlab-profile"
  role = aws_iam_role.gitlab.name
}

resource "aws_iam_policy" "gitlab_kms_secrets" {
  name = "datawai-gitlab-kms-secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gitlab_kms_secrets" {
  role       = aws_iam_role.gitlab.name
  policy_arn = aws_iam_policy.gitlab_kms_secrets.arn
}

resource "aws_security_group" "gitlab" {
  name_prefix = "datawai-gitlab-"
  vpc_id      = aws_vpc.management.id
  description = "GitLab management security group"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.management.cidr_block, aws_vpc.main.cidr_block, aws_vpc.staging.cidr_block]
    description = "HTTPS from internal VPCs"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.management.cidr_block]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.management.cidr_block]
    description = "SSH from internal only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    PDPA = "compliant"
  }
}

resource "aws_security_group" "gitlab_db" {
  name_prefix = "datawai-gitlab-db-"
  vpc_id      = aws_vpc.management.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
  }
}

resource "aws_security_group" "gitlab_redis" {
  name_prefix = "datawai-gitlab-redis-"
  vpc_id      = aws_vpc.management.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
  }
}

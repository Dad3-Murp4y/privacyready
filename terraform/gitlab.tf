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
  key_name   = "datawai-gitlab-key-${terraform.workspace}"
  public_key = tls_private_key.gitlab.public_key_openssh
}

resource "aws_instance" "gitlab" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = local.is_prod ? "t3.xlarge" : "t3.large"
  subnet_id              = local.gitlab_subnet_id
  vpc_security_group_ids = [aws_security_group.gitlab.id]
  key_name               = aws_key_pair.gitlab.key_name
  iam_instance_profile   = aws_iam_instance_profile.gitlab.name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  ebs_block_device {
    device_name = "/dev/sdb"
    volume_size = local.is_prod ? 500 : 50
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  user_data = <<-USERDATA
#!/bin/bash
yum update -y
yum install -y ansible jq

cat << 'EOF' > /tmp/gitlab.yml
${file("${path.module}/../ansible/gitlab.yml")}
EOF

export AWS_DEFAULT_REGION=${var.region}
DB_PASS=$(aws secretsmanager get-secret-value --secret-id ${local.db_secret_name} --query SecretString --output text)
if [ "${local.redis_secret_name}" != "none" ]; then
  REDIS_PASS=$(aws secretsmanager get-secret-value --secret-id ${local.redis_secret_name} --query SecretString --output text)
else
  REDIS_PASS="none"
fi

ansible-playbook -c local -i localhost, \
  -e "domain_name=${var.domain_name}" \
  -e "db_host=${local.db_host}" \
  -e "db_username=${local.is_prod ? "gitlab" : "datawai_admin"}" \
  -e "db_password=$DB_PASS" \
  -e "redis_host=${local.redis_host}" \
  -e "redis_password=$REDIS_PASS" \
  /tmp/gitlab.yml
USERDATA

  tags = merge(local.tags, {
    Name = "datawai-gitlab-primary"
    PDPA = "compliant"
  })
}

resource "aws_db_subnet_group" "gitlab" {
  count      = local.is_prod ? 1 : 0
  name       = "datawai-gitlab-db-subnet"
  subnet_ids = aws_subnet.management_private[*].id
  tags       = merge(local.tags, { Name = "datawai-gitlab-db-subnet" })
}

resource "aws_rds_cluster" "gitlab" {
  count                   = local.is_prod ? 1 : 0
  cluster_identifier      = "datawai-gitlab-postgres"
  engine                  = "aurora-postgresql"
  engine_version          = "15.13"
  database_name           = "gitlabhq_production"
  master_username         = "gitlab"
  master_password         = random_password.gitlab_db[0].result
  backup_retention_period = 30
  preferred_backup_window = "03:00-04:00"
  vpc_security_group_ids  = [aws_security_group.gitlab_db[0].id]
  db_subnet_group_name    = aws_db_subnet_group.gitlab[0].name
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.gitlab.arn
  deletion_protection     = false
  skip_final_snapshot     = true

  tags = merge(local.tags, {
    PDPA          = "compliant"
    DataResidency = "thailand"
  })
}

resource "aws_rds_cluster_instance" "gitlab" {
  count              = local.is_prod ? 2 : 0
  identifier         = "datawai-gitlab-db-instance-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.gitlab[0].id
  instance_class     = "db.t3.medium"
  engine             = aws_rds_cluster.gitlab[0].engine
  engine_version     = aws_rds_cluster.gitlab[0].engine_version
}

resource "aws_elasticache_subnet_group" "gitlab" {
  count      = local.is_prod ? 1 : 0
  name       = "datawai-gitlab-cache-subnet"
  subnet_ids = aws_subnet.management_private[*].id
}

resource "aws_elasticache_replication_group" "gitlab" {
  count                      = local.is_prod ? 1 : 0
  replication_group_id       = "datawai-gitlab-redis"
  description                = "GitLab Redis cluster"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.gitlab_redis[0].result
  subnet_group_name          = aws_elasticache_subnet_group.gitlab[0].name
  security_group_ids         = [aws_security_group.gitlab_redis[0].id]

  tags = merge(local.tags, {
    PDPA = "compliant"
  })
}

resource "aws_s3_bucket" "gitlab_artifacts" {
  count  = local.is_prod ? 1 : 0
  bucket = "datawai-gitlab-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.tags, {
    PDPA          = "compliant"
    DataResidency = "thailand"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "gitlab_artifacts" {
  count  = local.is_prod ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.gitlab.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "gitlab_artifacts" {
  count  = local.is_prod ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "gitlab_artifacts" {
  count  = local.is_prod ? 1 : 0
  bucket = aws_s3_bucket.gitlab_artifacts[0].id

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

  tags = merge(local.tags, {
    PDPA    = "compliant"
    Purpose = "gitlab-encryption"
  })
}

resource "aws_kms_alias" "gitlab" {
  name          = "alias/datawai-gitlab-pdpa-${terraform.workspace}"
  target_key_id = aws_kms_key.gitlab.key_id
}

resource "random_password" "gitlab_db" {
  count   = local.is_prod ? 1 : 0
  length  = 32
  special = false
}

resource "random_password" "gitlab_redis" {
  count   = local.is_prod ? 1 : 0
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "gitlab_db_password" {
  count                   = local.is_prod ? 1 : 0
  name                    = "datawai/gitlab/db-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_db_password" {
  count         = local.is_prod ? 1 : 0
  secret_id     = aws_secretsmanager_secret.gitlab_db_password[0].id
  secret_string = random_password.gitlab_db[0].result
}

resource "aws_secretsmanager_secret" "gitlab_redis_password" {
  count                   = local.is_prod ? 1 : 0
  name                    = "datawai/gitlab/redis-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_redis_password" {
  count         = local.is_prod ? 1 : 0
  secret_id     = aws_secretsmanager_secret.gitlab_redis_password[0].id
  secret_string = random_password.gitlab_redis[0].result
}

resource "aws_iam_role" "gitlab" {
  name = "datawai-gitlab-role-${terraform.workspace}"

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
  name = "datawai-gitlab-profile-${terraform.workspace}"
  role = aws_iam_role.gitlab.name
}

resource "aws_iam_policy" "gitlab_kms_secrets" {
  name = "datawai-gitlab-kms-secrets-${terraform.workspace}"
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

resource "aws_iam_role_policy_attachment" "gitlab_ssm" {
  role       = aws_iam_role.gitlab.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_security_group" "gitlab" {
  name_prefix = "datawai-gitlab-"
  vpc_id      = local.gitlab_vpc_id
  description = "GitLab security group"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "HTTPS from internal VPCs"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "SSH from internal only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    PDPA = "compliant"
  })
}

resource "aws_security_group" "gitlab_db" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "datawai-gitlab-db-"
  vpc_id      = aws_vpc.management[0].id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
  }
}

resource "aws_security_group" "gitlab_redis" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "datawai-gitlab-redis-"
  vpc_id      = aws_vpc.management[0].id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
  }
}

resource "aws_security_group_rule" "gitlab_ssh_from_eice" {
  type                     = "ingress"
  from_port                = 22
  to_port                  = 22
  protocol                 = "tcp"
  source_security_group_id = local.is_prod ? aws_security_group.eice[0].id : aws_security_group.test_eice[0].id
  security_group_id        = aws_security_group.gitlab.id
  description              = "SSH from EICE"
}

# Self-hosted GitLab server. Always-on now (no more is_prod
# conditional -- GitLab only ever made sense as a single persistent
# instance anyway) and using its own dedicated RDS (gitlab_rds.tf)
# instead of a database inside the app's shared RDS.

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
  key_name   = "privacyready-gitlab-key"
  public_key = tls_private_key.gitlab.public_key_openssh
}

resource "aws_instance" "gitlab" {
  count                  = var.gitlab_enabled ? 1 : 0
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.medium"
  subnet_id              = module.management_vpc.private_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.gitlab.id]
  key_name               = aws_key_pair.gitlab.key_name
  iam_instance_profile   = aws_iam_instance_profile.gitlab.name

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  ebs_block_device {
    device_name = "/dev/sdb"
    volume_size = 500
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  user_data = <<-USERDATA
#!/bin/bash
yum update -y
yum install -y ansible jq postgresql15

cat << 'EOF' > /tmp/gitlab.yml
${file("${path.module}/../../ansible/gitlab.yml")}
EOF

export AWS_DEFAULT_REGION=${var.region}
DB_PASS=$(aws secretsmanager get-secret-value --secret-id ${module.gitlab_rds[0].db_secret_name} --query SecretString --output text)
REDIS_PASS=$(aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.gitlab_redis_password[0].name} --query SecretString --output text)

# GitLab's dedicated RDS already has the 'gitlab' database created by
# default (see modules/rds's db_name), so no bootstrap SQL needed here
# unlike the old shared-database setup.
until pg_isready -h "${module.gitlab_rds[0].address}" -U "gitlab_admin" &>/dev/null; do
  echo "Waiting for postgres..."
  sleep 5
done

ansible-playbook -c local -i localhost, \
  -e "domain_name=${var.domain_name}" \
  -e "db_host=${module.gitlab_rds[0].address}" \
  -e "db_username=gitlab_admin" \
  -e "db_password=$DB_PASS" \
  -e "redis_host=${aws_elasticache_replication_group.gitlab[0].primary_endpoint_address}" \
  -e "redis_password=$REDIS_PASS" \
  /tmp/gitlab.yml
USERDATA

  tags = merge(local.tags, {
    Name = "privacyready-gitlab-primary"
    GDPR = "compliant"
  })

  lifecycle {
    ignore_changes  = [ami, user_data]
  }
}

resource "aws_elasticache_subnet_group" "gitlab" {
  count      = var.gitlab_enabled ? 1 : 0
  name       = "privacyready-gitlab-cache-subnet"
  subnet_ids = module.management_vpc.private_subnet_ids
}

resource "aws_elasticache_replication_group" "gitlab" {
  count                       = var.gitlab_enabled ? 1 : 0
  replication_group_id        = "privacyready-gitlab-redis"
  description                 = "GitLab Redis standalone node"
  engine                      = "redis"
  engine_version              = "7.0"
  node_type                   = "cache.t4g.micro"
  num_cache_clusters          = 1
  preferred_cache_cluster_azs = ["eu-west-2a"]
  automatic_failover_enabled = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.gitlab_redis[0].result
  subnet_group_name          = aws_elasticache_subnet_group.gitlab[0].name
  security_group_ids         = [aws_security_group.gitlab_redis[0].id]

  tags = merge(local.tags, { GDPR = "compliant" })
}

resource "aws_kms_key" "gitlab" {
  description             = "GitLab GDPR encryption key"
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

  tags = merge(local.tags, { GDPR = "compliant", Purpose = "gitlab-encryption" })
}

resource "aws_kms_alias" "gitlab" {
  name          = "alias/privacyready-gitlab-gdpr"
  target_key_id = aws_kms_key.gitlab.key_id
}

resource "random_password" "gitlab_redis" {
  count   = var.gitlab_enabled ? 1 : 0
  length  = 32
  special = false
}

# tfsec:ignore:aws-ssm-secret-use-customer-key
resource "aws_secretsmanager_secret" "gitlab_redis_password" {
  count                   = var.gitlab_enabled ? 1 : 0
  name                    = "privacyready/gitlab/redis-password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_redis_password" {
  count         = var.gitlab_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.gitlab_redis_password[0].id
  secret_string = random_password.gitlab_redis[0].result
}

resource "aws_iam_role" "gitlab" {
  name = "privacyready-gitlab-role"

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
  name = "privacyready-gitlab-profile"
  role = aws_iam_role.gitlab.name
}

resource "aws_iam_policy" "gitlab_kms_secrets" {
  name = "privacyready-gitlab-kms-secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          aws_secretsmanager_secret.gitlab_redis_password[0].arn,
          aws_kms_key.gitlab.arn
        ]
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

# tfsec:ignore:aws-ec2-no-public-egress-sgr
resource "aws_security_group" "gitlab" {
  name_prefix = "privacyready-gitlab-"
  vpc_id      = module.management_vpc.vpc_id
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
    description = "HTTP from internal VPCs"
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
    description = "Allow all outbound traffic"
  }

  tags = merge(local.tags, { GDPR = "compliant" })
}

resource "aws_security_group" "gitlab_redis" {
  count       = var.gitlab_enabled ? 1 : 0
  name_prefix = "privacyready-gitlab-redis-"
  vpc_id      = module.management_vpc.vpc_id
  description = "Redis security group"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
    description     = "Redis from GitLab"
  }
}

resource "aws_security_group_rule" "gitlab_ssh_from_eice" {
  type                     = "ingress"
  from_port                = 22
  to_port                  = 22
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eice.id
  security_group_id        = aws_security_group.gitlab.id
  description              = "SSH from EICE"
}

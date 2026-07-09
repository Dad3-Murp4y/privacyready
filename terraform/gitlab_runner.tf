# GitLab Runner instances and S3 caching configurations
resource "aws_instance" "gitlab_runner" {
  count                  = local.is_prod ? 2 : 0
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro"
  subnet_id              = local.private_subnet_ids[count.index]
  vpc_security_group_ids = [aws_security_group.gitlab_runner.id]
  iam_instance_profile   = aws_iam_instance_profile.gitlab_runner.name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
    kms_key_id  = aws_kms_key.gitlab.arn
  }

  user_data = <<USERDATA
#!/bin/bash
yum update -y
yum install -y docker gitlab-runner
USERDATA

  tags = {
    Name = "privacyready-gitlab-runner-${count.index + 1}"
    GDPR = "compliant"
  }
}

resource "aws_s3_bucket" "gitlab_runner_cache" {
  bucket = "privacyready-gitlab-runner-cache-${data.aws_caller_identity.current.account_id}-${terraform.workspace}"

  tags = {
    GDPR          = "compliant"
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

resource "aws_s3_bucket_lifecycle_configuration" "gitlab_runner_cache" {
  bucket = aws_s3_bucket.gitlab_runner_cache.id
  rule {
    id     = "expire-cache"
    status = "Enabled"

    filter {}

    expiration {
      days = 7
    }
  }
}

resource "aws_security_group" "gitlab_runner" {
  name_prefix = "privacyready-runner-"
  vpc_id      = local.gitlab_vpc_id
  description = "GitLab runner security group"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    GDPR = "compliant"
  }
}

resource "random_password" "gitlab_runner_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "gitlab_runner_token" {
  name                    = "privacyready/gitlab/runner-token-${terraform.workspace}"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "gitlab_runner_token" {
  secret_id     = aws_secretsmanager_secret.gitlab_runner_token.id
  secret_string = random_password.gitlab_runner_token.result
}

resource "aws_iam_role" "gitlab_runner" {
  name = "privacyready-gitlab-runner-role-${terraform.workspace}"

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

resource "aws_iam_instance_profile" "gitlab_runner" {
  name = "privacyready-gitlab-runner-profile-${terraform.workspace}"
  role = aws_iam_role.gitlab_runner.name
}

resource "aws_iam_policy" "gitlab_runner_s3" {
  name = "privacyready-gitlab-runner-s3-${terraform.workspace}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.gitlab_runner_cache.arn,
          "${aws_s3_bucket.gitlab_runner_cache.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gitlab_runner_s3" {
  role       = aws_iam_role.gitlab_runner.name
  policy_arn = aws_iam_policy.gitlab_runner_s3.arn
}

resource "aws_security_group_rule" "gitlab_runner_ssh_from_eice" {
  type                     = "ingress"
  from_port                = 22
  to_port                  = 22
  protocol                 = "tcp"
  source_security_group_id = local.is_prod ? aws_security_group.eice[0].id : aws_security_group.test_eice[0].id
  security_group_id        = aws_security_group.gitlab_runner.id
  description              = "SSH from EICE"
}

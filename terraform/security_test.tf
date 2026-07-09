# Simplified security groups for Testing Workspace
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "test_alb" {
  count       = local.is_prod ? 0 : 1
  name_prefix = "privacyready-test-alb-"
  vpc_id      = aws_vpc.test[0].id
  description = "ALB security group for testing"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from Internet"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from Internet"
  }


  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-test-alb-sg" })
}

resource "aws_security_group" "test_ecs_tasks" {
  count       = local.is_prod ? 0 : 1
  name_prefix = "privacyready-test-ecs-"
  vpc_id      = aws_vpc.test[0].id
  description = "ECS tasks security group for testing"

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.test_alb[0].id]
    description     = "ALB to ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-test-ecs-sg" })
}

resource "aws_security_group" "test_rds" {
  count       = local.is_prod ? 0 : 1
  name_prefix = "privacyready-test-rds-"
  vpc_id      = aws_vpc.test[0].id
  description = "RDS security group for testing"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.test_ecs_tasks[0].id]
    description     = "ECS tasks to RDS"
  }

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
    description     = "GitLab to RDS"
  }

  tags = merge(local.tags, { Name = "privacyready-test-rds-sg" })
}

resource "aws_security_group" "test_elasticache" {
  count       = local.is_prod ? 0 : 1
  name_prefix = "privacyready-test-cache-"
  vpc_id      = aws_vpc.test[0].id
  description = "ElastiCache security group for testing"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.test_ecs_tasks[0].id]
    description     = "ECS tasks to ElastiCache"
  }

  tags = merge(local.tags, { Name = "privacyready-test-cache-sg" })
}

resource "aws_security_group" "test_eice" {
  count       = local.is_prod ? 0 : 1
  name_prefix = "privacyready-test-eice-"
  vpc_id      = aws_vpc.test[0].id
  description = "EC2 Instance Connect Endpoint SG for testing"

  egress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.test[0].cidr_block]
  }

  tags = merge(local.tags, { Name = "privacyready-test-eice-sg" })
}

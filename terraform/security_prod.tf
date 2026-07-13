# Security groups for load balancer, container tasks, database, and cache tiers
data "aws_ec2_managed_prefix_list" "cloudfront_prod" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "privacyready-alb-"
  vpc_id      = aws_vpc.main[0].id
  description = "ALB security group for production"

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

  tags = merge(local.tags, { Name = "privacyready-alb-sg" })
}

resource "aws_security_group" "ecs_tasks" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "privacyready-ecs-"
  vpc_id      = aws_vpc.main[0].id
  description = "ECS tasks security group"

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb[0].id]
    description     = "ALB to ECS tasks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-ecs-sg" })
}

resource "aws_security_group" "rds" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "privacyready-rds-"
  vpc_id      = aws_vpc.main[0].id
  description = "RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks[0].id]
    description     = "ECS tasks to RDS"
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.management[0].cidr_block]
    description = "Management VPC to RDS (for GitLab)"
  }

  tags = merge(local.tags, { Name = "privacyready-rds-sg" })
}

resource "aws_security_group" "elasticache" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "privacyready-cache-"
  vpc_id      = aws_vpc.main[0].id
  description = "ElastiCache security group"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks[0].id]
    description     = "ECS tasks to ElastiCache"
  }

  tags = merge(local.tags, { Name = "privacyready-cache-sg" })
}

resource "aws_security_group" "eice" {
  count       = local.is_prod ? 1 : 0
  name_prefix = "privacyready-eice-"
  vpc_id      = aws_vpc.management[0].id
  description = "EC2 Instance Connect Endpoint SG"

  egress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.management[0].cidr_block]
  }

  tags = merge(local.tags, { Name = "privacyready-eice-sg" })
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name_prefix = "privacyready-alb-"
  vpc_id      = module.vpc.vpc_id
  description = "ALB security group for production"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from anywhere (CloudFront + API)"
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
  name_prefix = "privacyready-ecs-"
  vpc_id      = module.vpc.vpc_id
  description = "ECS tasks security group"

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "ALB to ECS tasks"
  }

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    self            = true
    description     = "Internal API to Scanner communication"
  }

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    self            = true
    description     = "Internal API to DSR communication"
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
  name_prefix = "privacyready-rds-"
  vpc_id      = module.vpc.vpc_id
  description = "RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "ECS tasks to RDS"
  }

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = ["10.2.0.0/16"]
    description     = "Management VPC (SES Lambda) to RDS"
  }

  tags = merge(local.tags, { Name = "privacyready-rds-sg" })
}

resource "aws_security_group" "elasticache" {
  name_prefix = "privacyready-cache-"
  vpc_id      = module.vpc.vpc_id
  description = "ElastiCache security group"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "ECS tasks to ElastiCache"
  }

  tags = merge(local.tags, { Name = "privacyready-cache-sg" })
}

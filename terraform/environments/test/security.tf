resource "aws_security_group" "alb" {
  name_prefix = "privacyready-test-alb-"
  vpc_id      = module.vpc.vpc_id
  description = "ALB security group for test"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-test-alb-sg" })
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "privacyready-test-ecs-"
  vpc_id      = module.vpc.vpc_id
  description = "ECS tasks security group"

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-test-ecs-sg" })
}

resource "aws_security_group" "rds" {
  name_prefix = "privacyready-test-rds-"
  vpc_id      = module.vpc.vpc_id
  description = "RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # NOTE: the original security_test.tf had a second ingress rule here
  # referencing aws_security_group.gitlab.id directly with no [0]
  # index -- a real bug, since that resource had count = local.is_prod
  # ? 1 : 0 and would have had zero instances in the test workspace,
  # making the reference invalid. Removed entirely rather than fixed,
  # since GitLab now has its own dedicated RDS (persistent/gitlab_rds.tf)
  # and never needs to reach this database at all.

  tags = merge(local.tags, { Name = "privacyready-test-rds-sg" })
}

resource "aws_security_group" "elasticache" {
  name_prefix = "privacyready-test-cache-"
  vpc_id      = module.vpc.vpc_id
  description = "ElastiCache security group"

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = merge(local.tags, { Name = "privacyready-test-cache-sg" })
}

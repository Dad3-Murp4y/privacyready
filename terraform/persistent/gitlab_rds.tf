# GitLab previously created a 'privacyready_gitlab' database inside
# the APP's shared RDS instance (see the old gitlab.tf comment:
# "Dedicated GitLab DB resources removed to support hosting on shared
# database"). That meant destroying the app environment's RDS would
# wipe GitLab's data even if the GitLab EC2 instance itself survived
# in a separate state. This is the actual fix: a small dedicated RDS
# just for GitLab, living in the persistent layer. Costs roughly
# £12-15/month extra for db.t3.micro single-AZ -- worth it for GitLab
# to genuinely not depend on the app environment's lifecycle.

module "gitlab_rds" {
  source = "../modules/rds"
  count  = var.gitlab_enabled ? 1 : 0

  name_prefix        = "privacyready-gitlab"
  subnet_ids         = module.management_vpc.private_subnet_ids
  security_group_id  = aws_security_group.gitlab_rds[0].id
  instance_class     = "db.t3.micro"
  multi_az           = false
  db_name            = "gitlab"
  db_username        = "gitlab_admin"
  tags               = local.tags
}

resource "aws_security_group" "gitlab_rds" {
  count       = var.gitlab_enabled ? 1 : 0
  name_prefix = "privacyready-gitlab-rds-"
  vpc_id      = module.management_vpc.vpc_id
  description = "GitLab's dedicated RDS security group"

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.gitlab.id]
    description     = "GitLab instance to its own RDS"
  }

  tags = merge(local.tags, { Name = "privacyready-gitlab-rds-sg" })
}

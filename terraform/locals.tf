locals {
  app_name    = "privacyready-api"
  environment = var.environment
  is_prod     = terraform.workspace == "production"

  vpc_id             = local.is_prod ? aws_vpc.main[0].id : aws_vpc.test[0].id
  private_subnet_ids = local.is_prod ? aws_subnet.private[*].id : aws_subnet.test_private[*].id
  public_subnet_ids  = local.is_prod ? aws_subnet.public[*].id : aws_subnet.test_public[*].id

  gitlab_vpc_id             = local.is_prod ? aws_vpc.management[0].id : aws_vpc.test[0].id
  gitlab_subnet_id          = local.is_prod ? aws_subnet.management_public[0].id : aws_subnet.test_public[0].id
  gitlab_private_subnet_ids = local.is_prod ? aws_subnet.management_private[*].id : aws_subnet.test_private[*].id

  db_host        = local.is_prod ? try(aws_db_instance.main[0].address, "gitlab-disabled") : aws_db_instance.test_db[0].address
  db_password    = local.is_prod ? try(random_password.db[0].result, "gitlab-disabled") : random_password.test_db[0].result
  db_secret_name = local.is_prod ? try(aws_secretsmanager_secret.db_password[0].name, "gitlab-disabled") : aws_secretsmanager_secret.test_db_password[0].name
  db_secret_arn  = local.is_prod ? try(aws_secretsmanager_secret.db_password[0].arn, "gitlab-disabled") : aws_secretsmanager_secret.test_db_password[0].arn

  redis_host        = local.is_prod ? try(aws_elasticache_replication_group.gitlab[0].primary_endpoint_address, "gitlab-disabled") : aws_elasticache_cluster.test_cache[0].cache_nodes[0].address
  redis_secret_name = local.is_prod ? aws_secretsmanager_secret.gitlab_redis_password[0].name : "none"

  ecs_sg_id = local.is_prod ? aws_security_group.ecs_tasks[0].id : aws_security_group.test_ecs_tasks[0].id
  alb_sg_id = local.is_prod ? aws_security_group.alb[0].id : aws_security_group.test_alb[0].id

  tags = {
    Project       = "privacyready"
    Environment   = local.environment
    Workspace     = terraform.workspace
    GDPR          = "compliant"
    DataResidency = "thailand"
    ManagedBy     = "terraform"
    Deployment    = "ecs-native-bluegreen"
  }
}

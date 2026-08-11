module "observability" {
  source = "../../modules/observability"

  name                    = local.name
  alb_arn_suffix          = replace(module.alb.alb_arn, "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:", "")
  target_group_arn_suffix = replace(module.alb.api_target_group_arn, "arn:aws:elasticloadbalancing:${var.aws_region}:${data.aws_caller_identity.current.account_id}:", "")
  ecs_cluster_name        = module.cluster.cluster_name
  api_service_name        = module.api.service_name
  scanner_service_name    = module.scanner.service_name
  rds_instance_identifier = module.database.db_instance_id
  enable_scanner_alarm    = var.scanner_desired_count > 0
  tags                    = var.common_tags
}

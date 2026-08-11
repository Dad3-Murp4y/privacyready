module "security_groups" {
  source = "../../modules/security-groups"
  name   = local.name
  vpc_id = module.vpc.vpc_id
  tags   = var.common_tags
}

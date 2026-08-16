module "alb" {
  source             = "../../modules/alb"
  name               = local.name
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_security_group_id]
  certificate_arn    = module.acm_certificate.certificate_arn
  tags               = var.common_tags
}

module "waf" {
  source  = "../../modules/waf"
  name    = local.name
  alb_arn = module.alb.alb_arn
  tags    = var.common_tags
}

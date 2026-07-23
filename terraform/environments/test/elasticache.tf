module "elasticache" {
  source = "../../modules/elasticache"

  name_prefix        = "privacyready-test"
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_id  = aws_security_group.elasticache.id
  tags               = local.tags
}

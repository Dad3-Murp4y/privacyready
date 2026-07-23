module "rds" {
  source = "../../modules/rds"

  name_prefix        = "privacyready"
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_id  = aws_security_group.rds.id
  instance_class     = "db.t3.micro"
  multi_az           = true
  tags               = local.tags
}

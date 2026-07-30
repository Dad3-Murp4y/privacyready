module "rds" {
  source = "../../modules/rds"

  name_prefix             = "privacyready-test"
  subnet_ids              = module.vpc.private_subnet_ids
  security_group_id       = aws_security_group.rds.id
  instance_class          = "db.t3.micro"
  multi_az                = false
  skip_final_snapshot     = false
  deletion_protection     = true
  backup_retention_period = 7
  tags                    = local.tags
}

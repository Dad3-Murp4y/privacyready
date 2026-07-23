module "vpc" {
  source = "../../modules/vpc"

  name_prefix = "privacyready-test"
  cidr_block  = "10.10.0.0/16"
  az_count    = 2
  tags        = local.tags
}

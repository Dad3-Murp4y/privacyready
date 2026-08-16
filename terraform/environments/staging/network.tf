module "vpc" {
  source                   = "../../modules/vpc"
  name                     = local.name
  vpc_cidr                 = "10.20.0.0/16"
  availability_zones       = local.azs
  public_subnet_cidrs      = ["10.20.0.0/24", "10.20.1.0/24"]
  private_app_subnet_cidrs = ["10.20.10.0/24", "10.20.11.0/24"]
  private_db_subnet_cidrs  = ["10.20.20.0/24", "10.20.21.0/24"]
  tags                     = var.common_tags
}

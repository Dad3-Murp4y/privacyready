module "ecr" {
  source = "../../modules/ecr"
  name   = local.name
  tags   = var.common_tags
}

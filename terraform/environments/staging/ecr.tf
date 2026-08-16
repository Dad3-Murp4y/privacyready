module "ecr" {
  source       = "../../modules/ecr"
  name         = local.name
  force_delete = true
  tags         = var.common_tags
}

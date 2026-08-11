module "hosted_zone" {
  source      = "../../modules/route53-hosted-zone"
  domain_name = var.domain_name
  tags        = var.tags
}

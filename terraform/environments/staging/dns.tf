module "acm_certificate" {
  source          = "../../modules/acm-dns-certificate"
  domain_name     = var.staging_hostname
  route53_zone_id = var.route53_zone_id
  tags            = var.common_tags
}

resource "aws_route53_record" "staging_alb" {
  zone_id = var.route53_zone_id
  name    = var.staging_hostname
  type    = "A"
  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

module "ses_identity" {
  source          = "../../modules/ses-domain-identity"
  domain_name     = var.ses_domain
  route53_zone_id = var.route53_zone_id
  aws_region      = var.aws_region
  tags            = var.common_tags
}

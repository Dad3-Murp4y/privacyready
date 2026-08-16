module "frontend_certificate" {
  source = "../../modules/acm-dns-certificate"

  providers = {
    aws = aws.us_east_1
  }

  domain_name     = var.frontend_hostname
  route53_zone_id = var.route53_zone_id
  tags            = var.common_tags
}

module "frontend" {
  source = "../../modules/cloudfront-static-site"

  name            = "${local.name}-frontend"
  bucket_name     = "${local.name}-frontend-${data.aws_caller_identity.current.account_id}"
  force_destroy   = true
  domain_name     = var.frontend_hostname
  certificate_arn = module.frontend_certificate.certificate_arn
  tags            = var.common_tags
}

resource "aws_route53_record" "staging_frontend" {
  zone_id = var.route53_zone_id
  name    = var.frontend_hostname
  type    = "A"

  alias {
    name                   = module.frontend.distribution_domain_name
    zone_id                = module.frontend.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

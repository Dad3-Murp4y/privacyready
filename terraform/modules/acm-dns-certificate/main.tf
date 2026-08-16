resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
  tags = merge(var.tags, { Name = var.domain_name, Component = "acm" })
}

resource "aws_route53_record" "validation" {
  for_each        = { for option in aws_acm_certificate.this.domain_validation_options : option.domain_name => option }
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  ttl             = 60
  records         = [each.value.resource_record_value]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

output "zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "domain_nameservers" {
  value = aws_route53_zone.main.name_servers
}

output "cloudfront_certificate_arn" {
  value = aws_acm_certificate_validation.cloudfront.certificate_arn
}

output "alb_certificate_arn" {
  value = aws_acm_certificate_validation.alb.certificate_arn
}

output "ecr_app_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecr_scanner_url" {
  value = aws_ecr_repository.scanner.repository_url
}

output "transit_gateway_id" {
  value = aws_ec2_transit_gateway.main.id
}

output "management_vpc_id" {
  value = module.management_vpc.vpc_id
}

output "management_vpc_cidr" {
  value = module.management_vpc.cidr_block
}

output "management_private_route_table_id" {
  value = module.management_vpc.private_route_table_id
}

output "eice_security_group_id" {
  value = aws_security_group.eice.id
}

output "ses_domain_identity_arn" {
  value = aws_ses_domain_identity.main.arn
}

output "alerts_sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

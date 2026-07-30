variable "domain_name" {
  type    = string
  default = "privacyready.co.uk"
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "superadmin_email" {
  type      = string
  sensitive = true
  default   = "admin@privacyready.co.uk"
}

variable "allowed_admin_ip_cidrs" {
  description = "IP addresses allowed to access restricted admin interfaces like GitLab and Grafana"
  type        = list(string)
  default     = ["2.127.11.148/32", "2a02:c7c:53b2:d800:9f49:8141:fbbd:13ae/128"]
}

locals {
  environment = "production"
  subdomain   = "" # Production live apex: privacyready.co.uk, api.privacyready.co.uk, portal.privacyready.co.uk

  apex_domain    = local.subdomain == "" ? var.domain_name : "${local.subdomain}.${var.domain_name}"
  www_domain     = local.subdomain == "" ? "www.${var.domain_name}" : "www.${local.subdomain}.${var.domain_name}"
  portal_domain  = local.subdomain == "" ? "portal.${var.domain_name}" : "${local.subdomain}-portal.${var.domain_name}"
  api_domain     = local.subdomain == "" ? "api.${var.domain_name}" : "${local.subdomain}-api.${var.domain_name}"
  grafana_domain = local.subdomain == "" ? "grafana.${var.domain_name}" : "grafana.${local.subdomain}.${var.domain_name}"

  tags = {
    Project     = "privacyready"
    Environment = "production"
    GDPR        = "compliant"
    ManagedBy   = "terraform"
  }

  zone_id              = data.terraform_remote_state.persistent.outputs.zone_id
  cloudfront_cert_arn  = "arn:aws:acm:us-east-1:700951986348:certificate/a476195f-a6bb-4a54-813f-166eb281314e"
  alb_cert_arn         = data.terraform_remote_state.persistent.outputs.alb_certificate_arn
  alerts_sns_topic_arn = data.terraform_remote_state.persistent.outputs.alerts_sns_topic_arn
}

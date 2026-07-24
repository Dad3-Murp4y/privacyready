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
  default   = "test-admin@privacyready.co.uk" # test environment, less sensitive than production
}

locals {
  environment = "test"
  subdomain   = "test" # test.privacyready.co.uk, test-api.privacyready.co.uk, test-portal.privacyready.co.uk

  tags = {
    Project     = "privacyready"
    Environment = "test"
    GDPR        = "compliant"
    ManagedBy   = "terraform"
  }

  zone_id              = data.terraform_remote_state.persistent.outputs.zone_id
  cloudfront_cert_arn  = "arn:aws:acm:us-east-1:700951986348:certificate/a476195f-a6bb-4a54-813f-166eb281314e"
  alb_cert_arn         = data.terraform_remote_state.persistent.outputs.alb_certificate_arn
  alerts_sns_topic_arn = data.terraform_remote_state.persistent.outputs.alerts_sns_topic_arn
}

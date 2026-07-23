variable "domain_name" {
  type    = string
  default = "privacyready.co.uk"
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "superadmin_email" {
  description = "Email address that gets SUPERADMIN role on registration. No default on purpose -- this repo is public, must be supplied via TF_VAR_superadmin_email or an untracked .tfvars file."
  type        = string
  sensitive   = true
}

variable "enable_bedrock" {
  type    = bool
  default = true
}

variable "create_n8n_rds" {
  type    = bool
  default = true
}

variable "create_n8n_redis" {
  type    = bool
  default = true
}

variable "existing_rds_host" {
  type    = string
  default = ""
}

variable "existing_redis_host" {
  type    = string
  default = ""
}

locals {
  app_name    = "privacyready-api"
  environment = "production"

  tags = {
    Project     = "privacyready"
    Environment = "production"
    GDPR        = "compliant"
    ManagedBy   = "terraform"
    Deployment  = "ecs-native-bluegreen"
  }

  # Values from the persistent layer, referenced via remote state
  # rather than direct resource access (different state files).
  zone_id                 = data.terraform_remote_state.persistent.outputs.zone_id
  cloudfront_cert_arn     = data.terraform_remote_state.persistent.outputs.cloudfront_certificate_arn
  alb_cert_arn            = data.terraform_remote_state.persistent.outputs.alb_certificate_arn
  transit_gateway_id      = data.terraform_remote_state.persistent.outputs.transit_gateway_id
  management_vpc_cidr     = data.terraform_remote_state.persistent.outputs.management_vpc_cidr
  management_route_table  = data.terraform_remote_state.persistent.outputs.management_private_route_table_id
  alerts_sns_topic_arn    = data.terraform_remote_state.persistent.outputs.alerts_sns_topic_arn
}

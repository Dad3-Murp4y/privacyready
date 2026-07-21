variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "privacyready.co.uk"
}

variable "alert_email" {
  description = "Email address to receive CloudWatch and Route 53 alerts"
  type        = string
  default     = "alerts.privacyready@gmail.com"
}

variable "superadmin_email" {
  description = "Email address that gets SUPERADMIN role on registration. No default on purpose -- this repo is public, so this must be supplied via TF_VAR_superadmin_email or an untracked .tfvars file, never committed."
  type        = string
  sensitive   = true
}

variable "gitlab_enabled" {
  description = "Set to false to hibernate GitLab (EC2 + Aurora) and save ~£200/month. EBS volumes, secrets, and DNS records are preserved."
  type        = bool
  default     = true
}

variable "enable_bedrock" {
  description = "Enable AWS Bedrock for AI agents"
  type        = bool
  default     = true
}

variable "create_n8n_rds" {
  description = "Create dedicated RDS for n8n (true) or use existing (false)"
  type        = bool
  default     = true
}

variable "create_n8n_redis" {
  description = "Create dedicated Redis for n8n (true) or use existing (false)"
  type        = bool
  default     = true
}

variable "existing_rds_host" {
  description = "Existing RDS host (if create_n8n_rds = false)"
  type        = string
  default     = ""
}

variable "existing_redis_host" {
  description = "Existing Redis host (if create_n8n_redis = false)"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region (alias for region, used by n8n module)"
  type        = string
  default     = "eu-west-2"
}


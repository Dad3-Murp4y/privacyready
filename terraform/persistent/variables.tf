variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "privacyready.co.uk"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "alert_email" {
  description = "Email address to receive GitLab-related alerts"
  type        = string
  default     = "alerts.privacyready@gmail.com"
}

variable "gitlab_enabled" {
  description = "Set to false to hibernate GitLab (stop paying for its EC2/RDS/ALB) while keeping its EBS volumes, secrets, and DNS records"
  type        = bool
  default     = true
}

locals {
  tags = {
    Project   = "privacyready"
    GDPR      = "compliant"
    ManagedBy = "terraform"
    Layer     = "persistent"
  }
}

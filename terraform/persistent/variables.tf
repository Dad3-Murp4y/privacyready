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

variable "allowed_admin_ip_cidrs" {
  description = "IP addresses allowed to access restricted admin interfaces like GitLab and Grafana"
  type        = list(string)
  default     = ["2.127.11.148/32", "2a02:c7c:53b2:d800:9f49:8141:fbbd:13ae/128"]
}

locals {
  tags = {
    Project   = "privacyready"
    GDPR      = "compliant"
    ManagedBy = "terraform"
    Layer     = "persistent"
  }
}

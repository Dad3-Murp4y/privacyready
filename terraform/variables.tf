variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
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

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "api_image" {
  type = string
  validation {
    condition     = !endswith(var.api_image, ":latest")
    error_message = "api_image must not use :latest."
  }
}

variable "scanner_image" {
  type = string
  validation {
    condition     = !endswith(var.scanner_image, ":latest")
    error_message = "scanner_image must not use :latest."
  }
}

variable "domain_name" {
  type    = string
  default = "privacyready.co.uk"
}

variable "staging_hostname" {
  type    = string
  default = "staging.privacyready.co.uk"
}
variable "route53_zone_id" { type = string }
variable "ses_domain" {
  type    = string
  default = "staging.privacyready.co.uk"
}
variable "database_name" { type = string }
variable "database_username" { type = string }
variable "api_cpu" { type = number }
variable "api_memory" { type = number }
variable "scanner_cpu" { type = number }
variable "scanner_memory" { type = number }
variable "api_desired_count" { type = number }
variable "scanner_desired_count" {
  type    = number
  default = 0
}

variable "ses_from_email" {
  type        = string
  description = "Verified staging SES sender identity email address."
}
variable "common_tags" { type = map(string) }

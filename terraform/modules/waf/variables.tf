variable "name" { type = string }
variable "alb_arn" { type = string }

variable "rate_limit" {
  type    = number
  default = 2000

  validation {
    condition     = var.rate_limit >= 100 && var.rate_limit <= 2000000
    error_message = "rate_limit must be between 100 and 2,000,000 requests per five minutes."
  }
}

variable "enable_aws_managed_common_rules" {
  type    = bool
  default = true
}

variable "enable_known_bad_inputs_rules" {
  type    = bool
  default = true
}

variable "enable_ip_reputation_rules" {
  type    = bool
  default = true
}

variable "sampled_requests_enabled" {
  type    = bool
  default = true
}

variable "cloudwatch_metrics_enabled" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

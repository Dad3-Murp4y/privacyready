variable "name" { type = string }
variable "vpc_id" { type = string }

variable "public_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "public_subnet_ids must contain at least two subnets."
  }
}

variable "security_group_ids" {
  type = list(string)
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "security_group_ids must not be empty."
  }
}

variable "certificate_arn" { type = string }

variable "target_port" {
  type    = number
  default = 8080
  validation {
    condition     = var.target_port >= 1 && var.target_port <= 65535
    error_message = "target_port must be between 1 and 65535."
  }
}

variable "health_check_path" {
  type    = string
  default = "/health"
  validation {
    condition     = startswith(var.health_check_path, "/")
    error_message = "health_check_path must begin with '/'."
  }
}

variable "health_check_matcher" {
  type    = string
  default = "200-399"
}

variable "enable_http_redirect" {
  type    = bool
  default = true
}

variable "idle_timeout" {
  type    = number
  default = 60
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

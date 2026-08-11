variable "name" { type = string }
variable "cluster_arn" { type = string }

variable "image" {
  type        = string
  description = "Immutable image reference, using a commit tag or digest."

  validation {
    condition     = !endswith(var.image, ":latest")
    error_message = "image must not use the mutable :latest tag."
  }
}

variable "container_port" {
  type = number
  validation {
    condition     = var.container_port >= 1 && var.container_port <= 65535
    error_message = "container_port must be between 1 and 65535."
  }
}

variable "cpu" {
  type = number
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096, 8192, 16384], var.cpu)
    error_message = "cpu must be a supported Fargate CPU value."
  }
}

variable "memory" {
  type = number
  validation {
    condition     = var.memory >= 512
    error_message = "memory must be at least 512 MiB."
  }
}

variable "desired_count" {
  type    = number
  default = 1
  validation {
    condition     = var.desired_count >= 0
    error_message = "desired_count cannot be negative."
  }
}

variable "subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.subnet_ids) > 0
    error_message = "At least one private subnet is required."
  }
}

variable "security_group_ids" {
  type = list(string)
  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one security group is required."
  }
}

variable "execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "environment" {
  type    = map(string)
  default = {}
}

variable "secrets" {
  type      = map(string)
  default   = {}
  sensitive = true
}

variable "log_retention_days" {
  type    = number
  default = 14
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "log_retention_days must be a CloudWatch Logs supported retention period."
  }
}

variable "aws_region" { type = string }

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "target_group_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "health_check_grace_period_seconds" {
  type    = number
  default = 60
}

variable "readonly_root_filesystem" {
  type    = bool
  default = true
}

variable "enable_execute_command" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "health_check" {
  type = object({
    command      = list(string)
    interval     = optional(number)
    timeout      = optional(number)
    retries      = optional(number)
    start_period = optional(number)
  })
  default  = null
  nullable = true
}

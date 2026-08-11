variable "name" {
  type        = string
  description = "Name prefix for database resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC containing the supplied subnets and security groups."
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private database subnet IDs."

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "subnet_ids must contain at least two private subnets."
  }
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security groups to attach to the DB instance."

  validation {
    condition     = length(var.security_group_ids) > 0
    error_message = "At least one supplied security group is required."
  }
}

variable "instance_class" { type = string }

variable "allocated_storage" {
  type        = number
  description = "Initial gp3 storage in GiB."

  validation {
    condition     = var.allocated_storage >= 20
    error_message = "allocated_storage must be at least 20 GiB."
  }
}

variable "max_allocated_storage" {
  type        = number
  description = "Autoscaling storage ceiling in GiB; set 0 to disable."
  default     = 0

  validation {
    condition     = var.max_allocated_storage == 0 || var.max_allocated_storage > var.allocated_storage
    error_message = "max_allocated_storage must be 0 or greater than allocated_storage."
  }
}

variable "multi_az" { type = bool }

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups."

  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "backup_retention_period must be between 0 and 35 days."
  }
}

variable "deletion_protection" { type = bool }
variable "skip_final_snapshot" { type = bool }

variable "database_name" {
  type        = string
  description = "Initial PostgreSQL database name."

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9]*$", var.database_name)) && length(var.database_name) <= 63
    error_message = "database_name must start with a letter, be alphanumeric, and be at most 63 characters."
  }
}

variable "database_username" {
  type        = string
  description = "Master PostgreSQL username."

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]*$", var.database_username)) && length(var.database_username) <= 63
    error_message = "database_username must start with a letter, contain only letters, digits, or underscores, and be at most 63 characters."
  }
}

variable "database_password" {
  type        = string
  description = "Master PostgreSQL password supplied securely by the caller."
  sensitive   = true
  default     = null
  nullable    = true
}

variable "manage_master_user_password" {
  type        = bool
  description = "Use the AWS-managed RDS master password instead of a caller password."
  default     = true
}

variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version."
}

variable "parameter_group_family" {
  type        = string
  description = "PostgreSQL parameter-group family documented by the caller."
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Whether to enable Performance Insights."
  default     = false
}

variable "apply_immediately" {
  type        = bool
  description = "Whether modifications should apply immediately."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to database resources."
  default     = {}
}

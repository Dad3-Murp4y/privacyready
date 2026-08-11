variable "name" {
  type        = string
  description = "Environment-aware prefix for secret names."
}

variable "secret_names" {
  type        = set(string)
  description = "Logical secret names to create."

  validation {
    condition = length(var.secret_names) > 0 && alltrue([
      for secret_name in var.secret_names :
      length(trimspace(secret_name)) > 0 && !startswith(secret_name, "/")
    ])
    error_message = "secret_names must be non-empty logical names and must not start with '/'."
  }
}

variable "recovery_window_in_days" {
  type        = number
  description = "Secrets Manager recovery window in days; zero performs force deletion if later destroyed."
  default     = 7

  validation {
    condition     = var.recovery_window_in_days >= 0 && var.recovery_window_in_days <= 30
    error_message = "recovery_window_in_days must be between 0 and 30."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to secret containers."
  default     = {}
}

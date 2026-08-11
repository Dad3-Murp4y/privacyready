variable "name" {
  type        = string
  description = "Environment-aware prefix for repository names."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to ECR repositories."
  default     = {}
}

variable "image_retention_count" {
  type        = number
  description = "Number of release-tagged images retained in each repository."
  default     = 25

  validation {
    condition     = var.image_retention_count >= 2
    error_message = "image_retention_count must be at least 2 to preserve rollback images."
  }
}

variable "untagged_image_expiry_days" {
  type        = number
  description = "Age in days after which untagged images expire."
  default     = 7

  validation {
    condition     = var.untagged_image_expiry_days >= 1
    error_message = "untagged_image_expiry_days must be at least 1."
  }
}

variable "release_tag_prefix" {
  type        = string
  description = "Immutable release-tag prefix retained by the lifecycle policy."
  default     = "release-"

  validation {
    condition     = length(trimspace(var.release_tag_prefix)) > 0
    error_message = "release_tag_prefix must not be empty."
  }
}

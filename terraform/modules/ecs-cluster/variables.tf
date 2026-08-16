variable "name" {
  type        = string
  description = "Name of the ECS cluster."
}

variable "enable_container_insights" {
  type        = bool
  description = "Whether to enable ECS Container Insights."
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the ECS cluster."
  default     = {}
}

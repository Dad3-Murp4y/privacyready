variable "name" {
  type        = string
  description = "Name prefix for the security groups."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID in which to create the security groups."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all security groups."
  default     = {}
}

variable "name" {
  type        = string
  description = "Name prefix for VPC resources."
}

variable "vpc_cidr" {
  type        = string
  description = "IPv4 CIDR range for the VPC."
}

variable "availability_zones" {
  type        = list(string)
  description = "Exactly two availability zones for the subnets."

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "availability_zones must contain exactly two AZs."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Two CIDR ranges for public subnets."

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "public_subnet_cidrs must contain exactly two CIDRs."
  }
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "Two CIDR ranges for private application subnets."

  validation {
    condition     = length(var.private_app_subnet_cidrs) == 2
    error_message = "private_app_subnet_cidrs must contain exactly two CIDRs."
  }
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "Two CIDR ranges for private database subnets."

  validation {
    condition     = length(var.private_db_subnet_cidrs) == 2
    error_message = "private_db_subnet_cidrs must contain exactly two CIDRs."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags applied consistently to all taggable resources."
  default     = {}
}

variable "domain_name" {
  description = "The SES domain identity name"
  type        = string
}

variable "database_url" {
  description = "The URL of the database to write suppression list to"
  type        = string
}

variable "vpc_subnet_ids" {
  description = "List of private subnet IDs for the Lambda function"
  type        = list(string)
  default     = []
}

variable "vpc_security_group_ids" {
  description = "List of security group IDs for the Lambda function"
  type        = list(string)
  default     = []
}

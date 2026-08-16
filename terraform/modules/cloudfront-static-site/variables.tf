variable "name" {
  type = string
}

variable "bucket_name" {
  type = string
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow Terraform destroy to remove versioned objects. Enable only for disposable environments."
}

variable "domain_name" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

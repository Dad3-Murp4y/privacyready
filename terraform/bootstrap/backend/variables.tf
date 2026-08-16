variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket used for fresh Privacy Ready Terraform state."

  validation {
    condition     = can(regex("^privacyready-terraform-state-[0-9]{12}$", var.bucket_name))
    error_message = "bucket_name must be privacyready-terraform-state- followed by the current 12-digit AWS account ID."
  }
}

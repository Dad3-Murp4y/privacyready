variable "name" { type = string }
variable "vpc_id" { type = string }
variable "namespace_name" {
  type        = string
  description = "Private DNS namespace, such as privacyready.local."
}
variable "service_name" { type = string }
variable "dns_ttl" {
  type    = number
  default = 10
  validation {
    condition     = var.dns_ttl >= 1 && var.dns_ttl <= 86400
    error_message = "dns_ttl must be between 1 and 86400 seconds."
  }
}
variable "tags" {
  type    = map(string)
  default = {}
}

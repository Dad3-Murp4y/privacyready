variable "name" {
  type = string
}

variable "bucket_name" {
  type = string
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

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}
variable "domain_name" {
  type    = string
  default = "privacyready.co.uk"
}
variable "tags" {
  type    = map(string)
  default = {}
}

variable "name" { type = string }
variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffix" { type = string }
variable "ecs_cluster_name" { type = string }
variable "api_service_name" { type = string }
variable "scanner_service_name" { type = string }
variable "rds_instance_identifier" { type = string }

variable "alarm_actions" {
  type    = list(string)
  default = []
}

variable "ok_actions" {
  type    = list(string)
  default = []
}

variable "enable_scanner_alarm" {
  type    = bool
  default = false
}

variable "alb_5xx_threshold" {
  type    = number
  default = 5
}

variable "rds_cpu_threshold" {
  type    = number
  default = 80
}

variable "rds_free_storage_threshold_bytes" {
  type    = number
  default = 2147483648
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_availability_zones" "available" { state = "available" }
data "aws_caller_identity" "current" {}

locals {
  name                  = "privacyready-staging"
  azs                   = slice(data.aws_availability_zones.available.names, 0, 2)
  execution_assume_role = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

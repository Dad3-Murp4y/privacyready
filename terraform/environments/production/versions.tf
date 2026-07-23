# PrivacyReady production app environment. Everything that's actually
# safe to destroy and recreate from scratch lives here: the app VPC,
# RDS, ElastiCache, ECS, ALB, CloudFront, WAF. `make destroy
# ENV=production` only ever touches this state -- it has no way to
# reach terraform/persistent (GitLab, Route53, SES, ECR), by
# construction, not by convention.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket       = "privacyready-terraform-state"
    key          = "environments/production/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project     = "privacyready"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "privacyready-terraform-state"
    key    = "persistent/terraform.tfstate"
    region = "eu-west-2"
  }
}

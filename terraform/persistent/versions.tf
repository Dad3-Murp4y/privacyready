# PrivacyReady persistent infrastructure.
#
# Everything in this directory has its own Terraform state, entirely
# separate from terraform/environments/{test,production}. Nothing here
# is ever touched by `make destroy ENV=test` or `make destroy
# ENV=production` -- those commands only ever run inside
# environments/<env>, which has no way to reach this state.
#
# What lives here and why: the hosted zone (Route53), SES domain
# verification, the CloudFront ACM certificate, ECR image repositories,
# the GitLab CI IAM user, and GitLab itself (with its own dedicated
# RDS and ALB -- see gitlab.tf/gitlab_rds.tf/gitlab_alb.tf for why
# GitLab needed its own database and load balancer to genuinely survive
# an app environment being torn down and rebuilt).
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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket       = "privacyready-terraform-state"
    key          = "persistent/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project   = "privacyready"
      ManagedBy = "terraform"
      Layer     = "persistent"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

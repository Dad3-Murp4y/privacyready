# PrivacyReady test app environment. Same shape as
# environments/production but smaller/cheaper resources, and its own
# subdomain (test.privacyready.co.uk / test-api.privacyready.co.uk /
# test-portal.privacyready.co.uk) rather than fighting production for
# the apex/api/portal records -- the original design never supported
# test and production being live simultaneously (those DNS records
# were unconditional/singleton), this makes that actually safe.

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
    key          = "environments/test/terraform.tfstate"
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
      Environment = "test"
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

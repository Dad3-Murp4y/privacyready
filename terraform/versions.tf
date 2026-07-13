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
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket      = "privacyready-terraform-state"
    key         = "platform/terraform.tfstate"
    region      = "eu-west-2"
    encrypt     = true
    use_lockfile = true # Replaces deprecated dynamodb_table; requires Terraform >= 1.10
  }
}

provider "aws" {
  region = "eu-west-2"

  default_tags {
    tags = {
      Project   = "privacyready"
      ManagedBy = "terraform"
    }
  }
}

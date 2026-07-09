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
    bucket         = "privacyready-terraform-state" # UPDATE this if the name is taken
    key            = "platform/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "privacyready-terraform-locks"
  }
}

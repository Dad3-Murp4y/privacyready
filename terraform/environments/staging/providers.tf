provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(var.common_tags, {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "privacyready"
    })
  }
}

# CloudFront requires its viewer certificate to be issued in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = merge(var.common_tags, {
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = "privacyready"
    })
  }
}

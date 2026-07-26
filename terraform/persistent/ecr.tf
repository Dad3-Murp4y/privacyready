# Moved here from ecs.tf. Environments reference these by constructing
# the image URI directly (account_id + region + repo name are all
# deterministic), so there's no cross-state data dependency needed for
# the ECS task definitions to use these -- only iam_cicd.tf below
# needs the actual resource ARNs, and that's in this same state.

# tfsec:ignore:aws-ecr-repository-customer-key
resource "aws_ecr_repository" "app" {
  name                 = "privacyready-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = merge(local.tags, { Name = "privacyready-api" })
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# tfsec:ignore:aws-ecr-repository-customer-key
resource "aws_ecr_repository" "scanner" {
  name                 = "privacyready-scanner"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
  tags = merge(local.tags, { Name = "privacyready-scanner" })
}

resource "aws_ecr_lifecycle_policy" "scanner" {
  repository = aws_ecr_repository.scanner.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}

# tfsec:ignore:aws-ecr-repository-customer-key
resource "aws_ecr_repository" "dsr" {
  name                 = "privacyready-dsr"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
  tags = merge(local.tags, { Name = "privacyready-dsr" })
}

resource "aws_ecr_lifecycle_policy" "dsr" {
  repository = aws_ecr_repository.dsr.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}

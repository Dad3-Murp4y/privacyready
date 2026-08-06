# The gitlab-ci-deployer credential needs to survive independently of
# whichever app environment is currently deployed (CI should be able
# to authenticate even mid-rebuild), so it lives here. It deploys to
# environments/production specifically -- ECS/IAM resource names below
# are constructed from the known, fixed naming convention used there
# rather than a live cross-state reference, since ARNs for
# not-yet-existing resources can't be looked up anyway (this policy
# may be applied before environments/production's first apply).

data "tls_certificate" "gitlab" {
  url = "https://gitlab.${var.domain_name}"
}

resource "aws_iam_openid_connect_provider" "gitlab" {
  url             = "https://gitlab.${var.domain_name}"
  client_id_list  = ["https://gitlab.${var.domain_name}"]
  thumbprint_list = [data.tls_certificate.gitlab.certificates[0].sha1_fingerprint]
}

resource "aws_iam_policy" "gitlab_ci" {
  name        = "privacyready-gitlab-ci-policy"
  description = "Strict least privilege policy for GitLab CI/CD deployments to environments/production"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "GetAuthorizationToken"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "AllowPushToSpecificRepos"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = [
          aws_ecr_repository.app.arn,
          aws_ecr_repository.scanner.arn
        ]
      },
      {
        Sid    = "AllowECSUpdateService"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = [
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/privacyready-cluster/privacyready-api",
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/privacyready-cluster/privacyready-scanner",
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/privacyready-cluster/privacyready-dsr"
        ]
      },
      {
        Sid    = "AllowRegisterTaskDefinition"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*" # Task definitions cannot be restricted by ARN before they are created
      },
      {
        Sid    = "AllowPassRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/privacyready-ecs-execution-role",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/privacyready-ecs-task-role"
        ]
        Condition = {
          StringLike = {
            "iam:PassedToService" : "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "gitlab_ci" {
  name = "gitlab-ci-deployer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.gitlab.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "gitlab.${var.domain_name}:sub" : "project_path:Dad3-Murp4y/privacyready:ref_type:branch:ref:*"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gitlab_ci" {
  role       = aws_iam_role.gitlab_ci.name
  policy_arn = aws_iam_policy.gitlab_ci.arn
}

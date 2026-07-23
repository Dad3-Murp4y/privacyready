# The gitlab-ci-deployer credential needs to survive independently of
# whichever app environment is currently deployed (CI should be able
# to authenticate even mid-rebuild), so it lives here. It deploys to
# environments/production specifically -- ECS/IAM resource names below
# are constructed from the known, fixed naming convention used there
# rather than a live cross-state reference, since ARNs for
# not-yet-existing resources can't be looked up anyway (this policy
# may be applied before environments/production's first apply).

resource "aws_iam_user" "gitlab_ci" {
  name = "gitlab-ci-deployer"
  tags = merge(local.tags, { Name = "gitlab-ci-deployer" })
}

resource "aws_iam_access_key" "gitlab_ci" {
  user = aws_iam_user.gitlab_ci.name
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
          aws_ecr_repository.scanner.arn,
          aws_ecr_repository.dsr.arn
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

resource "aws_iam_user_policy_attachment" "gitlab_ci" {
  user       = aws_iam_user.gitlab_ci.name
  policy_arn = aws_iam_policy.gitlab_ci.arn
}

resource "aws_secretsmanager_secret" "gitlab_ci_credentials" {
  name                    = "privacyready/gitlab/ci-credentials"
  description             = "AWS Access Keys for the gitlab-ci-deployer IAM user"
  recovery_window_in_days = 0

  tags = merge(local.tags, { Name = "gitlab-ci-credentials" })
}

resource "aws_secretsmanager_secret_version" "gitlab_ci_credentials" {
  secret_id = aws_secretsmanager_secret.gitlab_ci_credentials.id
  secret_string = jsonencode({
    AWS_ACCESS_KEY_ID     = aws_iam_access_key.gitlab_ci.id
    AWS_SECRET_ACCESS_KEY = aws_iam_access_key.gitlab_ci.secret
  })
}

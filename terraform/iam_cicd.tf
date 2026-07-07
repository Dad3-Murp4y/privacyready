# IAM User for GitLab CI/CD with strict least privilege
resource "aws_iam_user" "gitlab_ci" {
  name = "gitlab-ci-deployer"
  tags = merge(local.tags, { Name = "gitlab-ci-deployer" })
}

resource "aws_iam_access_key" "gitlab_ci" {
  user = aws_iam_user.gitlab_ci.name
}

# Policy allowing the CI/CD user to update ECS and push to specific ECR repos
resource "aws_iam_policy" "gitlab_ci" {
  name        = "datawai-gitlab-ci-policy"
  description = "Strict least privilege policy for GitLab CI/CD deployments"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # 1. Allow login to ECR
      {
        Sid      = "GetAuthorizationToken"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      # 2. Allow pushing only to specific ECR repositories
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
      # 3. Allow updating specific ECS services
      {
        Sid    = "AllowECSUpdateService"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = [
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}",
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${aws_ecs_service.scanner.name}",
          "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${aws_ecs_service.dsr.name}"
        ]
      },
      # 4. Allow registering new ECS Task Definitions
      {
        Sid    = "AllowRegisterTaskDefinition"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = "*" # Task definitions cannot be restricted by ARN before they are created
      },
      # 5. Allow passing the execution and task roles to ECS
      {
        Sid    = "AllowPassRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_task.arn
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

# Store the access keys securely in Secrets Manager
resource "aws_secretsmanager_secret" "gitlab_ci_credentials" {
  name                    = "datawai/gitlab/ci-credentials"
  description             = "AWS Access Keys for the gitlab-ci-deployer IAM user"
  recovery_window_in_days = 0 # Force delete without recovery window for ease of development

  tags = merge(local.tags, { Name = "gitlab-ci-credentials" })
}

resource "aws_secretsmanager_secret_version" "gitlab_ci_credentials" {
  secret_id = aws_secretsmanager_secret.gitlab_ci_credentials.id
  secret_string = jsonencode({
    AWS_ACCESS_KEY_ID     = aws_iam_access_key.gitlab_ci.id
    AWS_SECRET_ACCESS_KEY = aws_iam_access_key.gitlab_ci.secret
  })
}

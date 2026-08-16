module "cluster" {
  source                    = "../../modules/ecs-cluster"
  name                      = local.name
  enable_container_insights = true
  tags                      = var.common_tags
}

resource "aws_iam_role" "api_execution" {
  name               = "${local.name}-api-execution"
  assume_role_policy = local.execution_assume_role
}

resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = local.execution_assume_role
}

resource "aws_iam_role" "scanner_execution" {
  name               = "${local.name}-scanner-execution"
  assume_role_policy = local.execution_assume_role
}

resource "aws_iam_role" "scanner_task" {
  name               = "${local.name}-scanner-task"
  assume_role_policy = local.execution_assume_role
}

resource "aws_iam_role_policy" "api_task_ses" {
  name = "ses-send"
  role = aws_iam_role.api_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_domain}"
      Condition = {
        StringEquals = {
          "ses:FromAddress" = var.ses_from_email
        }
      }
    }]
  })
}

locals {
  api_secret_arns = [
    module.secrets.secret_arns["jwt-secret"],
    module.secrets.secret_arns["stripe-secret-key"],
    module.secrets.secret_arns["stripe-webhook-secret"],
    module.secrets.secret_arns["scanner-api-key"],
    module.database.master_user_secret_arn,
  ]
  scanner_secret_arns = [module.secrets.secret_arns["scanner-api-key"]]
}

resource "aws_iam_role_policy" "api_execution" {
  name = "runtime"
  role = aws_iam_role.api_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = [module.ecr.api_repository_arn] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name}-api:*" },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = local.api_secret_arns },
    ]
  })
}

resource "aws_iam_role_policy" "scanner_execution" {
  name = "runtime"
  role = aws_iam_role.scanner_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = [module.ecr.scanner_repository_arn] },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name}-scanner:*" },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = local.scanner_secret_arns },
    ]
  })
}

module "api" {
  source             = "../../modules/ecs-service"
  name               = "${local.name}-api"
  cluster_arn        = module.cluster.cluster_arn
  image              = var.api_image
  container_port     = 8080
  cpu                = var.api_cpu
  memory             = var.api_memory
  desired_count      = var.api_desired_count
  subnet_ids         = module.vpc.private_app_subnet_ids
  security_group_ids = [module.security_groups.api_security_group_id]
  execution_role_arn = aws_iam_role.api_execution.arn
  task_role_arn      = aws_iam_role.api_task.arn
  aws_region         = var.aws_region
  target_group_arn   = module.alb.api_target_group_arn
  environment        = { DB_HOST = module.database.db_endpoint, DB_NAME = module.database.db_name, DB_USER = var.database_username, SCANNER_URL = "http://${module.scanner_discovery.hostname}:8080", SES_FROM_EMAIL = var.ses_from_email, PORTAL_URL = "https://${var.frontend_hostname}", MARKETING_URL = "https://${var.frontend_hostname}" }
  secrets            = { DB_PASSWORD = "${module.database.master_user_secret_arn}:password::", JWT_SECRET = module.secrets.secret_arns["jwt-secret"], SCANNER_API_KEY = module.secrets.secret_arns["scanner-api-key"], STRIPE_SECRET_KEY = module.secrets.secret_arns["stripe-secret-key"], STRIPE_WEBHOOK_SECRET = module.secrets.secret_arns["stripe-webhook-secret"] }
  tags               = var.common_tags
}

module "scanner_discovery" {
  source         = "../../modules/service-discovery"
  name           = "${local.name}-scanner"
  vpc_id         = module.vpc.vpc_id
  namespace_name = "privacyready.local"
  service_name   = "scanner"
  tags           = var.common_tags
}

module "scanner" {
  source                        = "../../modules/ecs-service"
  name                          = "${local.name}-scanner"
  cluster_arn                   = module.cluster.cluster_arn
  image                         = var.scanner_image
  container_port                = 8080
  cpu                           = var.scanner_cpu
  memory                        = var.scanner_memory
  desired_count                 = var.scanner_desired_count
  subnet_ids                    = module.vpc.private_app_subnet_ids
  security_group_ids            = [module.security_groups.scanner_security_group_id]
  execution_role_arn            = aws_iam_role.scanner_execution.arn
  task_role_arn                 = aws_iam_role.scanner_task.arn
  aws_region                    = var.aws_region
  service_discovery_service_arn = module.scanner_discovery.service_arn
  secrets                       = { SCANNER_API_KEY = module.secrets.secret_arns["scanner-api-key"] }
  health_check                  = { command = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()\""] }
  tags                          = var.common_tags
}

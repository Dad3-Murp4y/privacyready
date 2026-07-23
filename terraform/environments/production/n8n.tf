# ============================================================
# N8N COMPLIANCE COPILOT — INTEGRATION WITH EXISTING INFRA
# ============================================================

locals {
  n8n_name = "${local.tags.Project}-n8n-copilot"
  n8n_env  = "production" # this file only exists in environments/production now, no more terraform.workspace
}

# --------------------------------------------------
# S3 BUCKET — For n8n binary data (NEW)
# --------------------------------------------------

resource "aws_s3_bucket" "n8n_binary" {
  bucket = "${local.n8n_name}-${local.n8n_env}-binary-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${local.n8n_name}-${local.n8n_env}-binary"
    Environment = local.n8n_env
    Service     = "n8n-compliance-copilot"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "n8n_binary" {
  bucket = aws_s3_bucket.n8n_binary.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.n8n.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "n8n_binary" {
  bucket = aws_s3_bucket.n8n_binary.id
  versioning_configuration {
    status = local.n8n_env == "production" ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_public_access_block" "n8n_binary" {
  bucket                  = aws_s3_bucket.n8n_binary.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --------------------------------------------------
# KMS KEY — For n8n encryption (NEW)
# --------------------------------------------------

resource "aws_kms_key" "n8n" {
  description             = "KMS key for n8n Compliance Copilot"
  deletion_window_in_days = local.n8n_env == "production" ? 30 : 7
  enable_key_rotation     = true

  tags = {
    Name        = "${local.n8n_name}-${local.n8n_env}"
    Environment = local.n8n_env
    Service     = "n8n-compliance-copilot"
  }
}

resource "aws_kms_alias" "n8n" {
  name          = "alias/${local.n8n_name}-${local.n8n_env}"
  target_key_id = aws_kms_key.n8n.key_id
}

# --------------------------------------------------
# SECRETS MANAGER — n8n credentials (NEW)
# --------------------------------------------------

resource "random_password" "n8n_encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "n8n_db_password" {
  length  = 32
  special = false
}

resource "random_password" "n8n_redis_password" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "n8n_encryption_key" {
  name        = "${local.n8n_name}/${local.n8n_env}/encryption-key"
  description = "n8n encryption key — BACK THIS UP"
  kms_key_id  = aws_kms_key.n8n.arn

  #lifecycle {
  #  prevent_destroy = true
  #}
}

resource "aws_secretsmanager_secret_version" "n8n_encryption_key" {
  secret_id     = aws_secretsmanager_secret.n8n_encryption_key.id
  secret_string = jsonencode({ key = random_password.n8n_encryption_key.result })
}

resource "aws_secretsmanager_secret" "n8n_db_credentials" {
  name        = "${local.n8n_name}/${local.n8n_env}/db-credentials"
  description = "n8n PostgreSQL credentials"
  kms_key_id  = aws_kms_key.n8n.arn

  #lifecycle {
  #  prevent_destroy = true
  #}
}

resource "aws_secretsmanager_secret_version" "n8n_db_credentials" {
  secret_id     = aws_secretsmanager_secret.n8n_db_credentials.id
  secret_string = jsonencode({ password = random_password.n8n_db_password.result, username = "n8n" })
}

# --------------------------------------------------
# IAM ROLES — For n8n ECS tasks (NEW)
# --------------------------------------------------

resource "aws_iam_role" "n8n_execution" {
  name = "${local.n8n_name}-${local.n8n_env}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "n8n_execution_managed" {
  role       = aws_iam_role.n8n_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "n8n_execution_secrets" {
  name = "${local.n8n_name}-${local.n8n_env}-execution-secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.n8n_encryption_key.arn,
          aws_secretsmanager_secret.n8n_db_credentials.arn,
          module.rds.db_secret_arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [
          aws_kms_key.n8n.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "n8n_execution_secrets" {
  role       = aws_iam_role.n8n_execution.name
  policy_arn = aws_iam_policy.n8n_execution_secrets.arn
}

resource "aws_iam_role" "n8n_task" {
  name = "${local.n8n_name}-${local.n8n_env}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Bedrock policy
resource "aws_iam_policy" "n8n_bedrock" {
  count = var.enable_bedrock != false ? 1 : 0
  name  = "${local.n8n_name}-${local.n8n_env}-bedrock"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:${var.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
          "arn:aws:bedrock:${var.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "n8n_bedrock" {
  count      = var.enable_bedrock != false ? 1 : 0
  role       = aws_iam_role.n8n_task.name
  policy_arn = aws_iam_policy.n8n_bedrock[0].arn
}

# S3 policy
resource "aws_iam_policy" "n8n_s3" {
  name = "${local.n8n_name}-${local.n8n_env}-s3"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [
        aws_s3_bucket.n8n_binary.arn,
        "${aws_s3_bucket.n8n_binary.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "n8n_s3" {
  role       = aws_iam_role.n8n_task.name
  policy_arn = aws_iam_policy.n8n_s3.arn
}

# --------------------------------------------------
# SECURITY GROUP — For n8n ECS tasks (NEW)
# --------------------------------------------------

resource "aws_security_group" "n8n_ecs" {
  name_prefix = "${local.n8n_name}-${local.n8n_env}-ecs-"
  description = "n8n ECS tasks"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 5678
    to_port         = 5678
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-ecs"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "n8n_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.n8n_ecs.id
  description              = "n8n ECS tasks to main RDS"
}

# --------------------------------------------------
# RDS — Uses your EXISTING RDS or creates n8n-specific one
# --------------------------------------------------

resource "aws_db_instance" "n8n" {
  count = var.create_n8n_rds ? 1 : 0

  identifier = "${local.n8n_name}-${local.n8n_env}-db"

  engine         = "postgres"
  engine_version = "15"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.n8n.arn

  db_name  = "n8n"
  username = "n8n"
  password = random_password.n8n_db_password.result

  multi_az = false

  vpc_security_group_ids = [aws_security_group.n8n_rds.id]
  db_subnet_group_name   = module.rds.subnet_group_name

  publicly_accessible = false

  backup_retention_period = 1
  backup_window           = "03:00-04:00"

  skip_final_snapshot = local.n8n_env == "testing"

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-db"
  }
}

resource "aws_security_group" "n8n_rds" {
  name_prefix = "${local.n8n_name}-${local.n8n_env}-rds-"
  description = "n8n PostgreSQL"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from n8n ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.n8n_ecs.id]
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-rds"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --------------------------------------------------
# REDIS — Uses your EXISTING ElastiCache or creates new
# --------------------------------------------------

resource "aws_elasticache_subnet_group" "n8n_redis" {
  count      = var.create_n8n_redis ? 1 : 0
  name       = "${local.n8n_name}-${local.n8n_env}-redis-subnet"
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_elasticache_cluster" "n8n_redis" {
  count = var.create_n8n_redis ? 1 : 0

  cluster_id           = "${local.n8n_name}-${local.n8n_env}-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.n8n_redis[0].name
  security_group_ids = [aws_security_group.n8n_redis.id]

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-redis"
  }
}

resource "aws_security_group" "n8n_redis" {
  name_prefix = "${local.n8n_name}-${local.n8n_env}-redis-"
  description = "n8n Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from n8n ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.n8n_ecs.id]
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-redis"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --------------------------------------------------
# ECS TASK DEFINITION — n8n container
# --------------------------------------------------

locals {
  n8n_db_host    = var.create_n8n_rds ? aws_db_instance.n8n[0].address : module.rds.address
  n8n_redis_host = var.create_n8n_redis ? aws_elasticache_cluster.n8n_redis[0].cache_nodes[0].address : var.existing_redis_host
}

resource "aws_ecs_task_definition" "n8n" {
  family                   = "${local.n8n_name}-${local.n8n_env}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]

  cpu    = local.n8n_env == "production" ? "1024" : "256"
  memory = local.n8n_env == "production" ? "2048" : "512"

  execution_role_arn = aws_iam_role.n8n_execution.arn
  task_role_arn      = aws_iam_role.n8n_task.arn

  container_definitions = jsonencode([{
    name  = "n8n"
    image = "n8nio/n8n:1.82.0"

    essential = true

    portMappings = [{
      containerPort = 5678
      protocol      = "tcp"
    }]

    environment = [
      { name = "DB_TYPE", value = "postgresdb" },
      { name = "DB_POSTGRESDB_HOST", value = local.n8n_db_host },
      { name = "DB_POSTGRESDB_PORT", value = "5432" },
      { name = "DB_POSTGRESDB_DATABASE", value = var.create_n8n_rds ? "n8n" : module.rds.db_name },
      { name = "DB_POSTGRESDB_USER", value = var.create_n8n_rds ? "n8n" : module.rds.username },
      { name = "DB_POSTGRESDB_SSL_ENABLED", value = "true" },
      { name = "DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED", value = "false" },
      { name = "N8N_HOST", value = "${local.n8n_name}-${local.n8n_env}.${var.domain_name}" },
      { name = "N8N_PROTOCOL", value = "https" },
      { name = "WEBHOOK_URL", value = "https://${local.n8n_name}-${local.n8n_env}.${var.domain_name}/" },
      { name = "N8N_PORT", value = "5678" },
      { name = "N8N_SECURE_COOKIE", value = "true" },
      { name = "EXECUTIONS_MODE", value = "queue" },
      { name = "QUEUE_BULL_REDIS_HOST", value = local.n8n_redis_host },
      { name = "QUEUE_BULL_REDIS_PORT", value = "6379" },
      { name = "EXECUTIONS_DATA_PRUNE", value = "true" },
      { name = "EXECUTIONS_DATA_MAX_AGE", value = local.n8n_env == "production" ? "168" : "72" },
      { name = "GENERIC_TIMEZONE", value = "Europe/London" },
      { name = "TZ", value = "Europe/London" },
      { name = "N8N_DEFAULT_BINARY_DATA_MODE", value = "s3" },
      { name = "N8N_AVAILABLE_BINARY_DATA_MODES", value = "filesystem,s3" },
      { name = "N8N_BINARY_DATA_STORAGE_PATH", value = "/home/node/.n8n/binaryData" },
      { name = "N8N_EXTERNAL_STORAGE_S3_BUCKET", value = aws_s3_bucket.n8n_binary.id },
      { name = "N8N_EXTERNAL_STORAGE_S3_REGION", value = var.region },
      { name = "N8N_METRICS", value = "true" },
      { name = "N8N_LOG_LEVEL", value = local.n8n_env == "production" ? "info" : "debug" }
    ]

    secrets = [
      {
        name      = "DB_POSTGRESDB_PASSWORD"
        valueFrom = var.create_n8n_rds ? "${aws_secretsmanager_secret.n8n_db_credentials.arn}:password::" : module.rds.db_secret_arn
      },
      {
        name      = "N8N_ENCRYPTION_KEY"
        valueFrom = "${aws_secretsmanager_secret.n8n_encryption_key.arn}:key::"
      },
      {
        name      = "QUEUE_BULL_REDIS_PASSWORD"
        valueFrom = "${aws_secretsmanager_secret.n8n_db_credentials.arn}:password::"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.n8n.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "n8n"
      }
    }
  }])
}

resource "aws_cloudwatch_log_group" "n8n" {
  name              = "/ecs/${local.n8n_name}-${local.n8n_env}"
  retention_in_days = local.n8n_env == "production" ? 365 : 7

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-logs"
  }
}

# --------------------------------------------------
# ECS SERVICE — n8n running on your EXISTING cluster
# --------------------------------------------------

resource "aws_ecs_service" "n8n" {
  name            = "${local.n8n_name}-${local.n8n_env}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.n8n.arn
  desired_count   = local.n8n_env == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnet_ids
    security_groups  = [aws_security_group.n8n_ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.n8n.arn
    container_name   = "n8n"
    container_port   = 5678
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener_rule.n8n]

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}"
  }
}

# --------------------------------------------------
# ALB TARGET GROUP & LISTENER RULE — Added to YOUR ALB
# --------------------------------------------------

resource "aws_lb_target_group" "n8n" {
  name        = "${local.tags.Project}-n8n-${local.n8n_env}-tg"
  port        = 5678
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-tg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener_rule" "n8n" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.n8n.arn
  }

  condition {
    host_header {
      values = ["${local.n8n_name}-${local.n8n_env}.${var.domain_name}"]
    }
  }
}

# --------------------------------------------------
# ROUTE53 RECORD — Added to YOUR DNS zone
# --------------------------------------------------

resource "aws_route53_record" "n8n" {
  zone_id = local.zone_id
  name    = "${local.n8n_name}-${local.n8n_env}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# --------------------------------------------------
# BEDROCK VPC ENDPOINTS — Private AI access
# --------------------------------------------------

resource "aws_vpc_endpoint" "bedrock_runtime" {
  count = var.enable_bedrock != false ? 1 : 0

  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.${var.region}.bedrock-runtime"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnet_ids
  security_group_ids  = [aws_security_group.n8n_bedrock_endpoint[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-bedrock-runtime"
  }
}

resource "aws_security_group" "n8n_bedrock_endpoint" {
  count = var.enable_bedrock != false ? 1 : 0

  name_prefix = "${local.n8n_name}-${local.n8n_env}-bedrock-endpoint-"
  description = "Bedrock VPC endpoint"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "HTTPS from n8n ECS"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.n8n_ecs.id]
  }

  tags = {
    Name = "${local.n8n_name}-${local.n8n_env}-bedrock-endpoint"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --------------------------------------------------
# OUTPUTS
# --------------------------------------------------

output "n8n_url" {
  description = "URL to access n8n"
  value       = "https://${local.n8n_name}-${local.n8n_env}.${var.domain_name}"
}

output "n8n_encryption_key_secret_arn" {
  description = "ARN of encryption key secret — BACK THIS UP"
  value       = aws_secretsmanager_secret.n8n_encryption_key.arn
  sensitive   = true
}

output "n8n_db_endpoint" {
  description = "RDS endpoint"
  value       = local.n8n_db_host
}

output "n8n_redis_endpoint" {
  description = "Redis endpoint"
  value       = local.n8n_redis_host
}

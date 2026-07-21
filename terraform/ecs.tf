# ECS Cluster, Fargate services, task definitions, auto-scaling, and IAM roles configurations
resource "aws_ecr_repository" "app" {
  name                 = "privacyready-api"
  image_tag_mutability = "MUTABLE"

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

resource "aws_ecs_cluster" "main" {
  name = "privacyready-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.tags, { Name = "privacyready-cluster" })
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/privacyready-api"
  retention_in_days = 30

  tags = merge(local.tags, { Name = "privacyready-api-logs" })
}

resource "aws_ecs_task_definition" "app" {
  family                   = "privacyready-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.app.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ecs"
      }
    }

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "8080" },
      { name = "DB_HOST", value = local.db_host },
      { name = "REDIS_HOST", value = local.redis_host },
      { name = "SUPERADMIN_EMAIL", value = var.superadmin_email }
    ]

    secrets = [
      {
        name      = "DB_PASSWORD"
        valueFrom = local.db_secret_arn
      },
      {
        name      = "JWT_SECRET"
        valueFrom = local.jwt_secret_arn
      }
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = merge(local.tags, { Name = "privacyready-api-task" })
}

resource "aws_ecs_service" "app" {
  name            = "privacyready-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.blue.arn
    container_name   = "api"
    container_port   = 8080
  }

  service_registries {
    registry_arn = aws_service_discovery_service.app.arn
  }

  propagate_tags = "SERVICE"
  tags           = merge(local.tags, { Name = "privacyready-api-service" })

  depends_on = [aws_lb_listener.https]
}

# ── Service Discovery (for internal communication) ─────────
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "privacyready.local"
  description = "Service discovery for PrivacyReady microservices"
  vpc         = local.vpc_id

  tags = merge(local.tags, { Name = "privacyready-service-discovery" })
}

resource "aws_service_discovery_service" "app" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(local.tags, { Name = "privacyready-api-discovery" })
}

resource "aws_service_discovery_service" "scanner" {
  name = "scanner"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(local.tags, { Name = "privacyready-scanner-discovery" })
}

# ── IAM Roles ───────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name = "privacyready-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = merge(local.tags, { Name = "privacyready-ecs-exec-role" })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "ecs_secrets_access" {
  name        = "privacyready-ecs-secrets-policy"
  description = "Allows ECS execution role to retrieve DB password and JWT signing secret"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ]
      Resource = [
        local.db_secret_arn,
        local.jwt_secret_arn
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = aws_iam_policy.ecs_secrets_access.arn
}

resource "aws_iam_role" "ecs_task" {
  name = "privacyready-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = merge(local.tags, { Name = "privacyready-ecs-task" })
}

# ── CloudWatch Alarms ───────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "privacyready-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS service CPU > 80%"

  dimensions = {
    ServiceName = aws_ecs_service.app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = merge(local.tags, { Name = "privacyready-high-cpu" })
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "privacyready-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS service memory > 80%"

  dimensions = {
    ServiceName = aws_ecs_service.app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = merge(local.tags, { Name = "privacyready-high-memory" })
}

# ── Auto Scaling ────────────────────────────────────────────
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "privacyready-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── ECR Repositories ────────────────────────────────────────

resource "aws_ecr_repository" "scanner" {
  name                 = "privacyready-scanner"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
  tags = merge(local.tags, { Name = "privacyready-scanner" })
}

resource "aws_ecr_repository" "dsr" {
  name                 = "privacyready-dsr"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS" }
  tags = merge(local.tags, { Name = "privacyready-dsr" })
}

# ── CloudWatch Log Groups ───────────────────────────────────

resource "aws_cloudwatch_log_group" "scanner" {
  name              = "/ecs/privacyready-scanner"
  retention_in_days = 30
  tags              = merge(local.tags, { Name = "privacyready-scanner-logs" })
}

resource "aws_cloudwatch_log_group" "dsr" {
  name              = "/ecs/privacyready-dsr"
  retention_in_days = 30
  tags              = merge(local.tags, { Name = "privacyready-dsr-logs" })
}

# ── ECS Task Definitions ────────────────────────────────────

resource "aws_ecs_task_definition" "scanner" {
  family                   = "privacyready-scanner"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "scanner"
    image     = "${aws_ecr_repository.scanner.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.scanner.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "dsr" {
  family                   = "privacyready-dsr"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "dsr"
    image     = "${aws_ecr_repository.dsr.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8000
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.dsr.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

# ── ECS Target Groups ───────────────────────────────────────

resource "aws_lb_target_group" "scanner" {
  name        = "pr-tg-scanner-${terraform.workspace}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,404"
    path                = "/docs"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "dsr" {
  name        = "pr-tg-dsr-${terraform.workspace}"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,404"
    path                = "/docs"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

# ── ECS Services ────────────────────────────────────────────

resource "aws_ecs_service" "scanner" {
  name            = "privacyready-scanner"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.scanner.arn
  desired_count   = 1

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.scanner.arn
    container_name   = "scanner"
    container_port   = 8080
  }

  service_registries {
    registry_arn = aws_service_discovery_service.scanner.arn
  }

  propagate_tags = "SERVICE"
  depends_on     = [aws_lb_listener_rule.scanner]
}

resource "aws_ecs_service" "dsr" {
  name            = "privacyready-dsr"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.dsr.arn
  desired_count   = 1

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.dsr.arn
    container_name   = "dsr"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener_rule.dsr]
}

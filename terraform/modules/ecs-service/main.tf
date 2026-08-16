locals {
  common_tags = merge(var.tags, {
    Component = "ecs-service"
  })

  health_check_definition = var.health_check == null ? {} : {
    healthCheck = merge(
      { command = var.health_check.command },
      var.health_check.interval == null ? {} : { interval = var.health_check.interval },
      var.health_check.timeout == null ? {} : { timeout = var.health_check.timeout },
      var.health_check.retries == null ? {} : { retries = var.health_check.retries },
      var.health_check.start_period == null ? {} : { startPeriod = var.health_check.start_period },
    )
  }

  container_definition = merge({
    name      = var.name
    image     = var.image
    essential = true
    cpu       = var.cpu
    memory    = var.memory
    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]
    environment = [for key, value in var.environment : {
      name  = key
      value = value
    }]
    secrets = [for key, value_from in var.secrets : {
      name      = key
      valueFrom = value_from
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.this.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = var.name
      }
    }
    readonlyRootFilesystem = var.readonly_root_filesystem
    linuxParameters = {
      initProcessEnabled = true
    }
  }, local.health_check_definition)
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn
  container_definitions    = jsonencode([local.container_definition])
  tags                     = local.common_tags
}

resource "aws_ecs_service" "this" {
  name                               = var.name
  cluster                            = var.cluster_arn
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  enable_execute_command             = var.enable_execute_command
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = var.target_group_arn == null ? null : var.health_check_grace_period_seconds

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arn == null ? [] : [var.target_group_arn]

    content {
      target_group_arn = load_balancer.value
      container_name   = var.name
      container_port   = var.container_port
    }
  }

  dynamic "service_registries" {
    for_each = var.service_discovery_service_arn == null ? [] : [var.service_discovery_service_arn]

    content {
      registry_arn = service_registries.value
    }
  }

  tags = local.common_tags
}

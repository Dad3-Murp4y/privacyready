# Dedicated Grafana & Prometheus Medium Monitoring Instance (1 vCPU / 2GB RAM)
# Monitors API HTTP metrics, Scanner daemon health, PostgreSQL RDS stats, and SaaS business metrics.

resource "aws_security_group" "monitoring" {
  name        = "privacyready-test-monitoring-sg"
  description = "Security group for Prometheus and Grafana monitoring stack"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "Grafana Web UI"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [module.vpc.cidr_block]
  }

  ingress {
    description = "Prometheus Metrics Server"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = [module.vpc.cidr_block]
  }

  ingress {
    description     = "Grafana Web UI from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-test-monitoring-sg" })
}

resource "aws_lb_target_group" "grafana" {
  name        = "pr-tg-grafana"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,302"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(local.tags, { Name = "privacyready-tg-grafana" })
}

resource "aws_lb_listener_rule" "grafana" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 95

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.grafana.arn
  }

  condition {
    host_header {
      values = [local.grafana_domain]
    }
  }

  condition {
    source_ip {
      values = var.allowed_admin_ip_cidrs
    }
  }
}

resource "aws_route53_record" "grafana" {
  zone_id = local.zone_id
  name    = local.grafana_domain
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = false
  }
}

resource "aws_service_discovery_service" "grafana" {
  name = "grafana"

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

  tags = merge(local.tags, { Name = "privacyready-test-grafana-discovery" })
}

resource "aws_service_discovery_service" "prometheus" {
  name = "prometheus"

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

  tags = merge(local.tags, { Name = "privacyready-test-prometheus-discovery" })
}

resource "aws_ecs_task_definition" "monitoring" {
  family                   = "privacyready-test-monitoring"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024" # 1 vCPU (Medium Instance)
  memory                   = "2048" # 2 GB RAM

  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "prometheus"
      image     = "prom/prometheus:v2.47.0"
      essential = true
      portMappings = [{
        containerPort = 9090
        protocol      = "tcp"
      }]
      command = [
        "--config.file=/etc/prometheus/prometheus.yml",
        "--storage.tsdb.path=/prometheus",
        "--web.enable-lifecycle"
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "wget --spider -q http://localhost:9090/-/healthy || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    },
    {
      name      = "grafana"
      image     = "grafana/grafana:10.1.0"
      essential = true
      portMappings = [{
        containerPort = 3000
        protocol      = "tcp"
      }]
      environment = [
        { name = "GF_SECURITY_ADMIN_USER", value = "admin" },
        { name = "GF_USERS_ALLOW_SIGN_UP", value = "false" },
        { name = "GF_SERVER_SERVE_FROM_SUB_PATH", value = "false" }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "wget --spider -q http://localhost:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = merge(local.tags, { Name = "privacyready-test-monitoring-task" })
}

resource "aws_ecs_service" "monitoring" {
  name            = "privacyready-test-monitoring"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.monitoring.arn
  desired_count   = 1

  network_configuration {
    subnets          = module.vpc.private_subnet_ids
    security_groups  = [aws_security_group.monitoring.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.grafana.arn
    container_name   = "grafana"
    container_port   = 3000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.grafana.arn
  }

  propagate_tags = "SERVICE"
  tags           = merge(local.tags, { Name = "privacyready-test-monitoring-service" })
}

output "grafana_public_url" {
  description = "IP-restricted HTTPS URL for Grafana Web UI"
  value       = "https://${local.grafana_domain}"
}

output "prometheus_service_discovery" {
  description = "Private DNS domain for Prometheus metrics server"
  value       = "http://prometheus.privacyready-test.local:9090"
}

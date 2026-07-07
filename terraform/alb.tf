# Application Load Balancer, listeners, target groups, and ACM certificate configurations
resource "aws_lb" "main" {
  name               = "datawai-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [local.alb_sg_id]
  subnets            = local.public_subnet_ids

  enable_deletion_protection = false
  enable_http2               = true

  tags = merge(local.tags, { Name = "datawai-alb" })
}

# Target Group Blue (current stable)
resource "aws_lb_target_group" "blue" {
  name        = "datawai-tg-blue-${terraform.workspace}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(local.tags, { Name = "datawai-tg-blue" })
}

# Target Group Green (new deployment)
resource "aws_lb_target_group" "green" {
  name        = "datawai-tg-green-${terraform.workspace}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(local.tags, { Name = "datawai-tg-green" })
}

# Listener - Production (port 80)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = merge(local.tags, { Name = "datawai-http-redirect" })
}

# ── Managed Route 53 Hosted Zone & Records ────────────────────
resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "DataWai public DNS zone - PDPA compliant"
  tags    = local.tags
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}



# ── ACM Certificate (Regional validation for ALB) ───────────
resource "aws_acm_certificate" "main" {
  domain_name               = "api.${var.domain_name}"
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

# NOTE: aws_acm_certificate_validation is intentionally omitted so Terraform does not hang waiting for you to update Nameservers.

# Listener - Production (port 443)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }

  tags = merge(local.tags, { Name = "datawai-https-listener" })
}

# Listener - Test (port 8443 for green validation)
resource "aws_lb_listener" "test" {
  load_balancer_arn = aws_lb.main.arn
  port              = "8443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.green.arn
  }

  tags = merge(local.tags, { Name = "datawai-test-listener" })
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ── GitLab Routing ──────────────────────────────────────────

resource "aws_lb_target_group" "gitlab" {
  name        = "datawai-tg-gitlab-${terraform.workspace}"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,301,302"
    path                = "/users/sign_in"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.tags, { Name = "datawai-tg-gitlab" })
}

resource "aws_lb_target_group_attachment" "gitlab" {
  target_group_arn  = aws_lb_target_group.gitlab.arn
  target_id         = aws_instance.gitlab.private_ip
  port              = 80
  availability_zone = "all"
}

resource "aws_lb_listener_rule" "gitlab" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gitlab.arn
  }

  condition {
    host_header {
      values = ["gitlab.${var.domain_name}"]
    }
  }
}

resource "aws_route53_record" "gitlab" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "gitlab.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

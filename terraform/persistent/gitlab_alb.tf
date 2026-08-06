# Previously GitLab was reachable only via a target group attached to
# the APP environment's own ALB (see the old alb.tf: aws_lb_target_group
# "gitlab" + aws_lb_listener_rule "gitlab"), meaning gitlab.privacyready.co.uk
# went down whenever that environment's ALB was destroyed. This gives
# GitLab its own small ALB, reusing the wildcard ACM cert already
# issued in acm.tf (*.privacyready.co.uk covers gitlab.privacyready.co.uk).

# tfsec:ignore:aws-ec2-no-public-ingress-sgr
# tfsec:ignore:aws-ec2-no-public-egress-sgr
resource "aws_security_group" "gitlab_alb" {
  name_prefix = "privacyready-gitlab-alb-"
  vpc_id      = module.management_vpc.vpc_id
  description = "GitLab ALB security group"

  ingress {
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = [for ip in var.allowed_admin_ip_cidrs : ip if !can(regex(":", ip))]
    ipv6_cidr_blocks = [for ip in var.allowed_admin_ip_cidrs : ip if can(regex(":", ip))]
    description      = "HTTPS restricted to Administrator IP"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.tags, { Name = "privacyready-gitlab-alb-sg" })
}

# tfsec:ignore:aws-elb-alb-not-public
resource "aws_lb" "gitlab" {
  count              = var.gitlab_enabled ? 1 : 0
  name               = "privacyready-gitlab-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.gitlab_alb.id]
  subnets            = module.management_vpc.public_subnet_ids

  enable_deletion_protection = true
  enable_http2                = true
  drop_invalid_header_fields  = true

  tags = merge(local.tags, { Name = "privacyready-gitlab-alb" })
}

resource "aws_lb_target_group" "gitlab" {
  count       = var.gitlab_enabled ? 1 : 0
  name        = "privacyready-gitlab-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = module.management_vpc.vpc_id
  target_type = "instance"

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

  tags = merge(local.tags, { Name = "privacyready-gitlab-tg" })
}

resource "aws_lb_target_group_attachment" "gitlab" {
  count            = var.gitlab_enabled ? 1 : 0
  target_group_arn = aws_lb_target_group.gitlab[0].arn
  target_id        = aws_instance.gitlab[0].id
  port             = 80
}

resource "aws_lb_listener" "gitlab_https" {
  count             = var.gitlab_enabled ? 1 : 0
  load_balancer_arn = aws_lb.gitlab[0].arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.alb.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gitlab[0].arn
  }

  tags = merge(local.tags, { Name = "privacyready-gitlab-https-listener" })
}

resource "aws_lb_listener" "gitlab_http" {
  count             = var.gitlab_enabled ? 1 : 0
  load_balancer_arn = aws_lb.gitlab[0].arn
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

  tags = merge(local.tags, { Name = "privacyready-gitlab-http-redirect" })
}

resource "aws_route53_record" "gitlab" {
  count   = var.gitlab_enabled ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "gitlab.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.gitlab[0].dns_name
    zone_id                = aws_lb.gitlab[0].zone_id
    evaluate_target_health = true
  }
}

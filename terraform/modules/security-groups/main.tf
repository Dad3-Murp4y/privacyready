locals {
  common_tags = merge(var.tags, {
    Component = "security-groups"
  })
}

resource "aws_security_group" "alb" {
  name                   = "${var.name}-alb"
  description            = "HTTPS ingress and API-only egress"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-alb"
  })
}

resource "aws_security_group" "api" {
  name                   = "${var.name}-api"
  description            = "API service traffic"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-api"
  })
}

resource "aws_security_group" "scanner" {
  name                   = "${var.name}-scanner"
  description            = "Scanner service traffic"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-scanner"
  })
}

resource "aws_security_group" "rds" {
  name                   = "${var.name}-rds"
  description            = "PostgreSQL from API only"
  vpc_id                 = var.vpc_id
  revoke_rules_on_delete = true

  tags = merge(local.common_tags, {
    Name = "${var.name}-rds"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS from the internet"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_redirect" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTP redirect to HTTPS"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.api.id
  description                  = "API traffic"
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
  description                  = "API traffic from ALB"
}

resource "aws_vpc_security_group_egress_rule" "api_to_scanner" {
  security_group_id            = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.scanner.id
  description                  = "Scanner traffic"
}

resource "aws_vpc_security_group_egress_rule" "api_to_rds" {
  security_group_id            = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.rds.id
  description                  = "PostgreSQL traffic"
}

resource "aws_vpc_security_group_egress_rule" "api_https" {
  security_group_id = aws_security_group.api.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Required external HTTPS traffic"
}

resource "aws_vpc_security_group_ingress_rule" "scanner_from_api" {
  security_group_id            = aws_security_group.scanner.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.api.id
  description                  = "Scanner traffic from API"
}

resource "aws_vpc_security_group_egress_rule" "scanner_http" {
  security_group_id = aws_security_group.scanner.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Website scanning HTTP traffic"
}

resource "aws_vpc_security_group_egress_rule" "scanner_https" {
  security_group_id = aws_security_group.scanner.id
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Website scanning HTTPS traffic"
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_api" {
  security_group_id            = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.api.id
  description                  = "PostgreSQL from API"
}

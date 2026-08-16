locals {
  common_tags = merge(var.tags, {
    Component = "service-discovery"
  })
}

resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = var.namespace_name
  description = "Private service discovery namespace for ${var.name}"
  vpc         = var.vpc_id
  tags        = local.common_tags
}

resource "aws_service_discovery_service" "this" {
  name = var.service_name

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.this.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = var.dns_ttl
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.common_tags
}

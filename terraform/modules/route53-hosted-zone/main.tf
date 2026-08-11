resource "aws_route53_zone" "this" {
  name = var.domain_name
  tags = merge(var.tags, { Name = var.domain_name, Component = "dns-bootstrap" })
}

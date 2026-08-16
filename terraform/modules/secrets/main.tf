locals {
  common_tags = merge(var.tags, {
    Component = "secrets"
  })
}

resource "aws_secretsmanager_secret" "this" {
  for_each = var.secret_names

  name                    = "${var.name}/${each.value}"
  description             = "${var.name} logical secret: ${each.value}. Value is populated outside Terraform."
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(local.common_tags, {
    Name = "${var.name}/${each.value}"
  })
}

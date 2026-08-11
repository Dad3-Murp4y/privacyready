locals {
  common_tags = merge(var.tags, {
    Component = "postgres"
  })
}

resource "aws_db_subnet_group" "this" {
  name        = "${var.name}-db"
  description = "Private subnets for ${var.name} PostgreSQL"
  subnet_ids  = var.subnet_ids

  tags = merge(local.common_tags, {
    Name = "${var.name}-db"
  })
}

resource "aws_db_instance" "this" {
  identifier             = "${var.name}-postgres"
  engine                 = "postgres"
  engine_version         = var.engine_version
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.max_allocated_storage == 0 ? null : var.max_allocated_storage
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = var.database_name
  username               = var.database_username
  password               = var.manage_master_user_password ? null : var.database_password
  manage_master_user_password = var.manage_master_user_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false
  multi_az               = var.multi_az

  backup_retention_period      = var.backup_retention_period
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = var.skip_final_snapshot
  copy_tags_to_snapshot        = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = var.performance_insights_enabled
  apply_immediately            = var.apply_immediately

  tags = merge(local.common_tags, {
    Name = "${var.name}-postgres"
  })
}

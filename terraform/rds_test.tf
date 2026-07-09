# RDS PostgreSQL database for Testing Workspace (Single-node)
resource "aws_db_subnet_group" "test" {
  count      = local.is_prod ? 0 : 1
  name       = "privacyready-test-db-subnet"
  subnet_ids = aws_subnet.test_private[*].id

  tags = merge(local.tags, { Name = "privacyready-test-db-subnet" })
}

resource "aws_db_instance" "test_db" {
  count                 = local.is_prod ? 0 : 1
  identifier            = "privacyready-test-db"
  engine                = "postgres"
  engine_version        = "15.13"
  instance_class        = "db.t3.micro"
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "privacyready"
  username = "privacyready_admin"
  password = random_password.test_db[0].result

  vpc_security_group_ids = [aws_security_group.test_rds[0].id]
  db_subnet_group_name   = aws_db_subnet_group.test[0].name
  multi_az               = false # Single AZ for testing
  publicly_accessible    = false

  backup_retention_period = 1 # Minimal backups for testing
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection = false
  skip_final_snapshot = true

  tags = merge(local.tags, { Name = "privacyready-test-db" })
}

resource "random_password" "test_db" {
  count   = local.is_prod ? 0 : 1
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "test_db_password" {
  count                   = local.is_prod ? 0 : 1
  name                    = "privacyready/test-db-password"
  description             = "PrivacyReady test database password"
  recovery_window_in_days = 0 # No recovery window needed for testing

  tags = merge(local.tags, { Name = "privacyready-test-db-secret" })
}

resource "aws_secretsmanager_secret_version" "test_db_password" {
  count         = local.is_prod ? 0 : 1
  secret_id     = aws_secretsmanager_secret.test_db_password[0].id
  secret_string = random_password.test_db[0].result
}

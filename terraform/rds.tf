# RDS PostgreSQL database, subnet group, and password secret configurations
resource "aws_db_subnet_group" "main" {
  name       = "datawai-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.tags, { Name = "datawai-db-subnet" })
}

resource "aws_db_instance" "main" {
  identifier             = "datawai-db"
  engine                 = "postgres"
  engine_version         = "15.13"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = "datawai"
  username = "datawai_admin"
  password = random_password.db.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  multi_az               = true
  publicly_accessible    = false

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  deletion_protection = false
  skip_final_snapshot = true

  tags = merge(local.tags, { Name = "datawai-db" })
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "datawai/db-password"
  description             = "DataWai database password"
  recovery_window_in_days = 7

  tags = merge(local.tags, { Name = "datawai-db-secret" })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

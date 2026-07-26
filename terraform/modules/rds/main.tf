variable "name_prefix" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "engine_version" {
  type    = string
  default = "15.13"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "max_allocated_storage" {
  type    = number
  default = 100
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "backup_retention_period" {
  type    = number
  default = 1
}

variable "backup_window" {
  type    = string
  default = "03:00-04:00"
}

variable "maintenance_window" {
  type    = string
  default = "Mon:04:00-Mon:05:00"
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}

variable "db_name" {
  type    = string
  default = "privacyready"
}

variable "db_username" {
  type    = string
  default = "privacyready_admin"
}

variable "secret_recovery_window_days" {
  type    = number
  default = 7
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}/db-password"
  description             = "${var.name_prefix} database password"
  recovery_window_in_days = var.secret_recovery_window_days
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-db-secret" })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.name_prefix}/jwt-secret"
  description             = "${var.name_prefix} API JWT signing secret"
  recovery_window_in_days = var.secret_recovery_window_days
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-jwt-secret" })
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt.result
}

resource "random_password" "scanner_api_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "scanner_api_key" {
  name                    = "${var.name_prefix}/scanner-api-key"
  description             = "${var.name_prefix} shared secret between the API and scanner services"
  recovery_window_in_days = var.secret_recovery_window_days
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-scanner-api-key" })
}

resource "aws_secretsmanager_secret_version" "scanner_api_key" {
  secret_id     = aws_secretsmanager_secret.scanner_api_key.id
  secret_string = random_password.scanner_api_key.result
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name_prefix}-db"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.max_allocated_storage
  storage_type            = "gp3"
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.security_group_id]

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  multi_az             = var.multi_az
  publicly_accessible  = false

  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-final-snapshot"

  tags = merge(var.tags, { Name = "${var.name_prefix}-db" })
}

output "address" {
  value = aws_db_instance.this.address
}

output "identifier" {
  value = aws_db_instance.this.identifier
}

output "db_name" {
  value = aws_db_instance.this.db_name
}

output "username" {
  value = aws_db_instance.this.username
}

output "password" {
  value     = random_password.db.result
  sensitive = true
}

output "db_secret_name" {
  value = aws_secretsmanager_secret.db_password.name
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "scanner_api_key_arn" {
  value = aws_secretsmanager_secret.scanner_api_key.arn
}

output "subnet_group_name" {
  value = aws_db_subnet_group.this.name
}

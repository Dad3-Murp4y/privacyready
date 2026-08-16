output "db_instance_id" {
  value       = aws_db_instance.this.id
  description = "RDS DB instance identifier."
}

output "db_instance_arn" {
  value       = aws_db_instance.this.arn
  description = "RDS DB instance ARN."
}

output "db_endpoint" {
  value       = aws_db_instance.this.address
  description = "RDS hostname without credentials."
}

output "db_port" {
  value       = aws_db_instance.this.port
  description = "PostgreSQL port."
}

output "db_name" {
  value       = aws_db_instance.this.db_name
  description = "Initial database name."
}

output "db_subnet_group_name" {
  value       = aws_db_subnet_group.this.name
  description = "DB subnet group name."
}

output "master_user_secret_arn" {
  value       = try(aws_db_instance.this.master_user_secret[0].secret_arn, null)
  description = "AWS-managed master-user secret ARN when managed credentials are enabled."
}

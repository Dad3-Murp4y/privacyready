output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "ALB security group ID."
}

output "api_security_group_id" {
  value       = aws_security_group.api.id
  description = "API security group ID."
}

output "scanner_security_group_id" {
  value       = aws_security_group.scanner.id
  description = "Scanner security group ID."
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS security group ID."
}

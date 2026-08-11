output "secret_arns" {
  value       = { for logical_name, secret in aws_secretsmanager_secret.this : logical_name => secret.arn }
  description = "Secret ARNs keyed by logical input secret name."
}

output "secret_names" {
  value       = { for logical_name, secret in aws_secretsmanager_secret.this : logical_name => secret.name }
  description = "Created secret names keyed by logical input secret name."
}

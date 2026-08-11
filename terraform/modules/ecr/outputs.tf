output "api_repository_url" {
  value       = aws_ecr_repository.api.repository_url
  description = "API ECR repository URL."
}

output "api_repository_arn" {
  value       = aws_ecr_repository.api.arn
  description = "API ECR repository ARN."
}

output "api_repository_name" {
  value       = aws_ecr_repository.api.name
  description = "API ECR repository name."
}

output "scanner_repository_url" {
  value       = aws_ecr_repository.scanner.repository_url
  description = "Scanner ECR repository URL."
}

output "scanner_repository_arn" {
  value       = aws_ecr_repository.scanner.arn
  description = "Scanner ECR repository ARN."
}

output "scanner_repository_name" {
  value       = aws_ecr_repository.scanner.name
  description = "Scanner ECR repository name."
}

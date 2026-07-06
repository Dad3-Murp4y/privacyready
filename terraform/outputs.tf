# Output parameters exposing endpoint references and service discovery details
output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "cache_endpoint" {
  description = "ElastiCache endpoint"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

data "aws_caller_identity" "current" {}

output "domain_nameservers" {
  description = "Route 53 Nameservers for the domain"
  value       = aws_route53_zone.main.name_servers
}

output "alb_dns_name" { value = module.alb.alb_dns_name }
output "api_repository_url" { value = module.ecr.api_repository_url }
output "scanner_repository_url" { value = module.ecr.scanner_repository_url }
output "database_endpoint" { value = module.database.db_endpoint }
output "frontend_url" { value = "https://${var.frontend_hostname}" }
output "frontend_bucket_name" { value = module.frontend.bucket_name }
output "cloudfront_distribution_id" { value = module.frontend.distribution_id }

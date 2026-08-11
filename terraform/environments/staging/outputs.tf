output "alb_dns_name" { value = module.alb.alb_dns_name }
output "api_repository_url" { value = module.ecr.api_repository_url }
output "scanner_repository_url" { value = module.ecr.scanner_repository_url }
output "database_endpoint" { value = module.database.db_endpoint }

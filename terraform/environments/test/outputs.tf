output "vpc_id" {
  value = module.vpc.vpc_id
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_address" {
  value = module.rds.address
}

output "cache_endpoint" {
  value = module.elasticache.address
}

output "frontend_bucket_id" {
  value = aws_s3_bucket.frontend.id
}

output "portal_bucket_id" {
  value = aws_s3_bucket.portal.id
}

output "frontend_cloudfront_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "portal_cloudfront_id" {
  value = aws_cloudfront_distribution.portal.id
}

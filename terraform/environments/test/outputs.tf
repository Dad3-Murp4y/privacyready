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

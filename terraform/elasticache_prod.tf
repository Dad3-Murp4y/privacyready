# ElastiCache Redis cluster configuration
resource "aws_elasticache_subnet_group" "main" {
  count      = local.is_prod ? 1 : 0
  name       = "privacyready-cache-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "main" {
  count                = local.is_prod ? 1 : 0
  cluster_id           = "privacyready-cache"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main[0].name
  security_group_ids   = [aws_security_group.elasticache[0].id]

  tags = merge(local.tags, { Name = "privacyready-cache" })
}

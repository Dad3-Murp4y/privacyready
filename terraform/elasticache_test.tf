# ElastiCache Redis cluster configuration for Testing Workspace
resource "aws_elasticache_subnet_group" "test" {
  count      = local.is_prod ? 0 : 1
  name       = "datawai-test-cache-subnet"
  subnet_ids = aws_subnet.test_private[*].id
}

resource "aws_elasticache_cluster" "test_cache" {
  count                = local.is_prod ? 0 : 1
  cluster_id           = "datawai-test-cache"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.test[0].name
  security_group_ids   = [aws_security_group.test_elasticache[0].id]

  tags = merge(local.tags, { Name = "datawai-test-cache" })
}

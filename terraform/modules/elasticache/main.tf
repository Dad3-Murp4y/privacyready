variable "name_prefix" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "node_type" {
  type    = string
  default = "cache.t3.micro"
}

variable "num_cache_nodes" {
  type    = number
  default = 1
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-cache-subnet"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${var.name_prefix}-cache"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.security_group_id]

  tags = merge(var.tags, { Name = "${var.name_prefix}-cache" })
}

output "address" {
  value = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "cluster_id" {
  value = aws_elasticache_cluster.this.cluster_id
}

output "vpc_id" {
  value       = aws_vpc.this.id
  description = "ID of the VPC."
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs, ordered by availability_zones."
}

output "private_app_subnet_ids" {
  value       = aws_subnet.private_app[*].id
  description = "Private application subnet IDs, ordered by availability_zones."
}

output "private_db_subnet_ids" {
  value       = aws_subnet.private_db[*].id
  description = "Private database subnet IDs, ordered by availability_zones."
}

output "nat_gateway_id" {
  value       = aws_nat_gateway.this.id
  description = "ID of the single NAT Gateway."
}

output "s3_vpc_endpoint_id" {
  value       = aws_vpc_endpoint.s3.id
  description = "ID of the S3 Gateway VPC Endpoint."
}

# Transit Gateway to connect Production, Staging, and Management VPCs
resource "aws_ec2_transit_gateway" "main" {
  count                           = local.is_prod ? 1 : 0
  description                     = "DataWai Inter-VPC Transit Gateway"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"

  tags = merge(local.tags, { Name = "datawai-tgw" })
}

# Attach Production VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "production" {
  count              = local.is_prod ? 1 : 0
  transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  vpc_id             = aws_vpc.main[0].id
  subnet_ids         = aws_subnet.private[*].id

  tags = merge(local.tags, { Name = "datawai-production-tgw-attachment" })
}

# Attach Staging VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "staging" {
  count              = local.is_prod ? 1 : 0
  transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  vpc_id             = aws_vpc.staging[0].id
  subnet_ids         = aws_subnet.staging_private[*].id

  tags = merge(local.tags, { Name = "datawai-staging-tgw-attachment" })
}

# Attach Management VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "management" {
  count              = local.is_prod ? 1 : 0
  transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  vpc_id             = aws_vpc.management[0].id
  subnet_ids         = aws_subnet.management_private[*].id

  tags = merge(local.tags, { Name = "datawai-management-tgw-attachment" })
}


# Transit Gateway to connect Production, Staging, and Management VPCs
resource "aws_ec2_transit_gateway" "main" {
  description                     = "DataWai Inter-VPC Transit Gateway"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"

  tags = merge(local.tags, { Name = "datawai-tgw" })
}

# Attach Production VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "production" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id             = aws_vpc.main.id
  subnet_ids         = aws_subnet.private[*].id

  tags = merge(local.tags, { Name = "datawai-production-tgw-attachment" })
}

# Attach Staging VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "staging" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id             = aws_vpc.staging.id
  subnet_ids         = aws_subnet.staging_private[*].id

  tags = merge(local.tags, { Name = "datawai-staging-tgw-attachment" })
}

# Attach Management VPC to Transit Gateway
resource "aws_ec2_transit_gateway_vpc_attachment" "management" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id             = aws_vpc.management.id
  subnet_ids         = aws_subnet.management_private[*].id

  tags = merge(local.tags, { Name = "datawai-management-tgw-attachment" })
}

# Add Transit Gateway routes to private route tables to route cross-VPC traffic
resource "aws_route" "production_to_staging" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = aws_vpc.staging.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

resource "aws_route" "production_to_management" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = aws_vpc.management.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

resource "aws_route" "staging_to_production" {
  route_table_id         = aws_route_table.staging_private.id
  destination_cidr_block = aws_vpc.main.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

resource "aws_route" "staging_to_management" {
  route_table_id         = aws_route_table.staging_private.id
  destination_cidr_block = aws_vpc.management.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

resource "aws_route" "management_to_production" {
  route_table_id         = aws_route_table.management_private.id
  destination_cidr_block = aws_vpc.main.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

resource "aws_route" "management_to_staging" {
  route_table_id         = aws_route_table.management_private.id
  destination_cidr_block = aws_vpc.staging.cidr_block
  transit_gateway_id     = aws_ec2_transit_gateway.main.id
}

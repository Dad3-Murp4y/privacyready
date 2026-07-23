# Transit Gateway lives here (persistent) since it's connective
# infrastructure that shouldn't be recreated every time an app
# environment is rebuilt. The management VPC attaches to it here;
# environments/production attaches its own VPC(s) on the other side
# by referencing this TGW's ID via terraform_remote_state.

resource "aws_ec2_transit_gateway" "main" {
  description                     = "PrivacyReady Inter-VPC Transit Gateway"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support                     = "enable"

  tags = merge(local.tags, { Name = "privacyready-tgw" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "management" {
  transit_gateway_id = aws_ec2_transit_gateway.main.id
  vpc_id              = module.management_vpc.vpc_id
  subnet_ids          = module.management_vpc.private_subnet_ids

  tags = merge(local.tags, { Name = "privacyready-management-tgw-attachment" })
}

# Route from management's private subnets toward the production VPC(s)
# via the TGW. The reverse routes (production/staging -> management)
# are declared in environments/production, since that's where those
# route tables live.
resource "aws_route" "management_to_production" {
  route_table_id         = module.management_vpc.private_route_table_id
  destination_cidr_block = "10.0.0.0/16" # environments/production's main VPC CIDR
  transit_gateway_id     = aws_ec2_transit_gateway.main.id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.management]
}

resource "aws_route" "management_to_staging" {
  route_table_id         = module.management_vpc.private_route_table_id
  destination_cidr_block = "10.1.0.0/16" # environments/production's staging VPC CIDR
  transit_gateway_id     = aws_ec2_transit_gateway.main.id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.management]
}

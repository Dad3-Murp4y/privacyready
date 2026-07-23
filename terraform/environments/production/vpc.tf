module "vpc" {
  source = "../../modules/vpc"

  name_prefix = "privacyready"
  cidr_block  = "10.0.0.0/16"
  az_count    = 2
  tags        = local.tags
}

module "staging_vpc" {
  source = "../../modules/vpc"

  name_prefix = "privacyready-staging"
  cidr_block  = "10.1.0.0/16"
  az_count    = 2
  tags        = merge(local.tags, { Environment = "staging" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "production" {
  transit_gateway_id = local.transit_gateway_id
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids

  tags = merge(local.tags, { Name = "privacyready-production-tgw-attachment" })
}

resource "aws_ec2_transit_gateway_vpc_attachment" "staging" {
  transit_gateway_id = local.transit_gateway_id
  vpc_id              = module.staging_vpc.vpc_id
  subnet_ids          = module.staging_vpc.private_subnet_ids

  tags = merge(local.tags, { Name = "privacyready-staging-tgw-attachment" })
}

# Route from main VPC's private subnets toward the management VPC
# (where GitLab lives) via the TGW.
resource "aws_route" "main_to_management" {
  route_table_id         = module.vpc.private_route_table_id
  destination_cidr_block = local.management_vpc_cidr
  transit_gateway_id     = local.transit_gateway_id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.production]
}

resource "aws_route" "main_to_staging" {
  route_table_id         = module.vpc.private_route_table_id
  destination_cidr_block = module.staging_vpc.cidr_block
  transit_gateway_id     = local.transit_gateway_id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.staging]
}

resource "aws_route" "staging_to_management" {
  route_table_id         = module.staging_vpc.private_route_table_id
  destination_cidr_block = local.management_vpc_cidr
  transit_gateway_id     = local.transit_gateway_id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.staging]
}

resource "aws_route" "staging_to_main" {
  route_table_id         = module.staging_vpc.private_route_table_id
  destination_cidr_block = module.vpc.cidr_block
  transit_gateway_id     = local.transit_gateway_id

  depends_on = [aws_ec2_transit_gateway_vpc_attachment.production]
}

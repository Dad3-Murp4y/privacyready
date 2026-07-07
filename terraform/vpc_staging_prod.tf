# Staging VPC and Networking configuration for DataWai
resource "aws_vpc" "staging" {
  count                = local.is_prod ? 1 : 0
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name        = "datawai-staging-vpc"
    Environment = "staging"
  })
}

resource "aws_internet_gateway" "staging" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.staging[0].id
  tags   = merge(local.tags, { Name = "datawai-staging-igw", Environment = "staging" })
}

# Public subnets (Staging ALB)
resource "aws_subnet" "staging_public" {
  count                   = local.is_prod ? 2 : 0
  vpc_id                  = aws_vpc.staging[0].id
  cidr_block              = "10.1.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name        = "datawai-staging-public-${count.index + 1}"
    Type        = "public"
    Environment = "staging"
  })
}

# Private subnets (Staging ECS tasks & backend resources)
resource "aws_subnet" "staging_private" {
  count             = local.is_prod ? 2 : 0
  vpc_id            = aws_vpc.staging[0].id
  cidr_block        = "10.1.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, {
    Name        = "datawai-staging-private-${count.index + 1}"
    Type        = "private"
    Environment = "staging"
  })
}

# NAT Gateway for staging private subnet outbound
resource "aws_eip" "staging_nat" {
  count  = local.is_prod ? 1 : 0
  domain = "vpc"
  tags   = merge(local.tags, { Name = "datawai-staging-nat-eip", Environment = "staging" })
}

resource "aws_nat_gateway" "staging" {
  count         = local.is_prod ? 1 : 0
  allocation_id = aws_eip.staging_nat[0].id
  subnet_id     = aws_subnet.staging_public[0].id
  tags          = merge(local.tags, { Name = "datawai-staging-nat", Environment = "staging" })
}

resource "aws_route_table" "staging_public" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.staging[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging[0].id
  }
  tags = merge(local.tags, { Name = "datawai-staging-public-rt", Environment = "staging" })
}

resource "aws_route_table_association" "staging_public" {
  count          = local.is_prod ? 2 : 0
  subnet_id      = aws_subnet.staging_public[count.index].id
  route_table_id = aws_route_table.staging_public[0].id
}

resource "aws_route_table" "staging_private" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.staging[0].id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.staging[0].id
  }
  route {
    cidr_block         = aws_vpc.main[0].cidr_block
    transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  }
  route {
    cidr_block         = aws_vpc.management[0].cidr_block
    transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  }
  tags = merge(local.tags, { Name = "datawai-staging-private-rt", Environment = "staging" })
}

resource "aws_route_table_association" "staging_private" {
  count          = local.is_prod ? 2 : 0
  subnet_id      = aws_subnet.staging_private[count.index].id
  route_table_id = aws_route_table.staging_private[0].id
}

# VPC and Networking configuration for DataWai
resource "aws_vpc" "main" {
  count                = local.is_prod ? 1 : 0
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "privacyready-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.main[0].id
  tags   = merge(local.tags, { Name = "privacyready-igw" })
}

# Public subnets (ALB)
resource "aws_subnet" "public" {
  count                   = local.is_prod ? 2 : 0
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "privacyready-public-${count.index + 1}"
    Type = "public"
  })
}

# Private subnets (ECS tasks & backend resources)
resource "aws_subnet" "private" {
  count             = local.is_prod ? 2 : 0
  vpc_id            = aws_vpc.main[0].id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, {
    Name = "privacyready-private-${count.index + 1}"
    Type = "private"
  })
}

# NAT Gateway for private subnet outbound
resource "aws_eip" "nat" {
  count  = local.is_prod ? 1 : 0
  domain = "vpc"
  tags   = merge(local.tags, { Name = "privacyready-nat-eip" })
}

resource "aws_nat_gateway" "main" {
  count         = local.is_prod ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.tags, { Name = "privacyready-nat" })
}

resource "aws_route_table" "public" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.main[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }
  route {
    cidr_block         = aws_vpc.management[0].cidr_block
    transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  }
  tags = merge(local.tags, { Name = "privacyready-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = local.is_prod ? 2 : 0
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table" "private" {
  count  = local.is_prod ? 1 : 0
  vpc_id = aws_vpc.main[0].id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }
  route {
    cidr_block         = aws_vpc.staging[0].cidr_block
    transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  }
  route {
    cidr_block         = aws_vpc.management[0].cidr_block
    transit_gateway_id = aws_ec2_transit_gateway.main[0].id
  }
  tags = merge(local.tags, { Name = "privacyready-private-rt" })
}

resource "aws_route_table_association" "private" {
  count          = local.is_prod ? 2 : 0
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

data "aws_availability_zones" "available" {
  state = "available"
}

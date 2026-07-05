# Staging VPC and Networking configuration for DataWai
resource "aws_vpc" "staging" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name        = "datawai-staging-vpc"
    Environment = "staging"
  })
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id
  tags   = merge(local.tags, { Name = "datawai-staging-igw", Environment = "staging" })
}

# Public subnets (Staging ALB)
resource "aws_subnet" "staging_public" {
  count                   = 2
  vpc_id                  = aws_vpc.staging.id
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
  count             = 2
  vpc_id            = aws_vpc.staging.id
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
  domain = "vpc"
  tags   = merge(local.tags, { Name = "datawai-staging-nat-eip", Environment = "staging" })
}

resource "aws_nat_gateway" "staging" {
  allocation_id = aws_eip.staging_nat.id
  subnet_id     = aws_subnet.staging_public[0].id
  tags          = merge(local.tags, { Name = "datawai-staging-nat", Environment = "staging" })
}

resource "aws_route_table" "staging_public" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }
  tags = merge(local.tags, { Name = "datawai-staging-public-rt", Environment = "staging" })
}

resource "aws_route_table_association" "staging_public" {
  count          = 2
  subnet_id      = aws_subnet.staging_public[count.index].id
  route_table_id = aws_route_table.staging_public.id
}

resource "aws_route_table" "staging_private" {
  vpc_id = aws_vpc.staging.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.staging.id
  }
  tags = merge(local.tags, { Name = "datawai-staging-private-rt", Environment = "staging" })
}

resource "aws_route_table_association" "staging_private" {
  count          = 2
  subnet_id      = aws_subnet.staging_private[count.index].id
  route_table_id = aws_route_table.staging_private.id
}

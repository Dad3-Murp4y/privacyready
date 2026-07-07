# Single consolidated VPC for Testing Workspace
resource "aws_vpc" "test" {
  count                = local.is_prod ? 0 : 1
  cidr_block           = "10.10.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, { Name = "datawai-test-vpc" })
}

resource "aws_internet_gateway" "test" {
  count  = local.is_prod ? 0 : 1
  vpc_id = aws_vpc.test[0].id
  tags   = merge(local.tags, { Name = "datawai-test-igw" })
}

# Public subnets (ALB & Bastion)
resource "aws_subnet" "test_public" {
  count                   = local.is_prod ? 0 : 2
  vpc_id                  = aws_vpc.test[0].id
  cidr_block              = "10.10.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "datawai-test-public-${count.index + 1}"
    Type = "public"
  })
}

# Private subnets (ECS, RDS, Cache, GitLab)
resource "aws_subnet" "test_private" {
  count             = local.is_prod ? 0 : 2
  vpc_id            = aws_vpc.test[0].id
  cidr_block        = "10.10.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, {
    Name = "datawai-test-private-${count.index + 1}"
    Type = "private"
  })
}

# NAT Gateway (Single NAT for testing)
resource "aws_eip" "test_nat" {
  count  = local.is_prod ? 0 : 1
  domain = "vpc"
  tags   = merge(local.tags, { Name = "datawai-test-nat-eip" })
}

resource "aws_nat_gateway" "test" {
  count         = local.is_prod ? 0 : 1
  allocation_id = aws_eip.test_nat[0].id
  subnet_id     = aws_subnet.test_public[0].id
  tags          = merge(local.tags, { Name = "datawai-test-nat" })
}

resource "aws_route_table" "test_public" {
  count  = local.is_prod ? 0 : 1
  vpc_id = aws_vpc.test[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.test[0].id
  }
  tags = merge(local.tags, { Name = "datawai-test-public-rt" })
}

resource "aws_route_table_association" "test_public" {
  count          = local.is_prod ? 0 : 2
  subnet_id      = aws_subnet.test_public[count.index].id
  route_table_id = aws_route_table.test_public[0].id
}

resource "aws_route_table" "test_private" {
  count  = local.is_prod ? 0 : 1
  vpc_id = aws_vpc.test[0].id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.test[0].id
  }
  tags = merge(local.tags, { Name = "datawai-test-private-rt" })
}

resource "aws_route_table_association" "test_private" {
  count          = local.is_prod ? 0 : 2
  subnet_id      = aws_subnet.test_private[count.index].id
  route_table_id = aws_route_table.test_private[0].id
}

resource "aws_ec2_instance_connect_endpoint" "test" {
  count              = local.is_prod ? 0 : 1
  subnet_id          = aws_subnet.test_private[0].id
  security_group_ids = [aws_security_group.test_eice[0].id]

  tags = merge(local.tags, { Name = "datawai-test-eice" })
}

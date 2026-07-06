# Management VPC and Networking configuration for DataWai GitLab & CI/CD tools
resource "aws_vpc" "management" {
  cidr_block           = "10.2.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name        = "datawai-management-vpc"
    Environment = "management"
  })
}

resource "aws_internet_gateway" "management" {
  vpc_id = aws_vpc.management.id
  tags   = merge(local.tags, { Name = "datawai-management-igw", Environment = "management" })
}

# Public subnets (for bastion / external access)
resource "aws_subnet" "management_public" {
  count                   = 2
  vpc_id                  = aws_vpc.management.id
  cidr_block              = "10.2.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name        = "datawai-management-public-${count.index + 1}"
    Type        = "public"
    Environment = "management"
  })
}

# Private subnets (for GitLab primary instance & database nodes)
resource "aws_subnet" "management_private" {
  count             = 2
  vpc_id            = aws_vpc.management.id
  cidr_block        = "10.2.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, {
    Name        = "datawai-management-private-${count.index + 1}"
    Type        = "private"
    Environment = "management"
  })
}

# NAT Gateway for management private subnet outbound
resource "aws_eip" "management_nat" {
  domain = "vpc"
  tags   = merge(local.tags, { Name = "datawai-management-nat-eip", Environment = "management" })
}

resource "aws_nat_gateway" "management" {
  allocation_id = aws_eip.management_nat.id
  subnet_id     = aws_subnet.management_public[0].id
  tags          = merge(local.tags, { Name = "datawai-management-nat", Environment = "management" })
}

resource "aws_route_table" "management_public" {
  vpc_id = aws_vpc.management.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.management.id
  }
  tags = merge(local.tags, { Name = "datawai-management-public-rt", Environment = "management" })
}

resource "aws_route_table_association" "management_public" {
  count          = 2
  subnet_id      = aws_subnet.management_public[count.index].id
  route_table_id = aws_route_table.management_public.id
}

resource "aws_route_table" "management_private" {
  vpc_id = aws_vpc.management.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.management.id
  }
  tags = merge(local.tags, { Name = "datawai-management-private-rt", Environment = "management" })
}

resource "aws_route_table_association" "management_private" {
  count          = 2
  subnet_id      = aws_subnet.management_private[count.index].id
  route_table_id = aws_route_table.management_private.id
}

resource "aws_ec2_instance_connect_endpoint" "main" {
  subnet_id          = aws_subnet.management_private[0].id
  security_group_ids = [aws_security_group.eice.id]

  tags = merge(local.tags, { Name = "datawai-eice" })
}

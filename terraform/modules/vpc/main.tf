variable "name_prefix" {
  description = "Prefix for resource names and tags, e.g. 'privacyready' or 'privacyready-test'"
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for the VPC, e.g. 10.0.0.0/16"
  type        = string
}

variable "az_count" {
  description = "Number of availability zones (and public/private subnet pairs) to create"
  type        = number
  default     = 2
}

variable "public_subnet_offset" {
  description = "Third octet offset for public subnets (e.g. 1 -> 10.0.1.0/24, 10.0.2.0/24)"
  type        = number
  default     = 1
}

variable "private_subnet_offset" {
  description = "Third octet offset for private subnets (e.g. 10 -> 10.0.10.0/24, 10.0.11.0/24)"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Base tags applied to all resources; Name is set per-resource on top of these"
  type        = map(string)
  default     = {}
}

data "aws_availability_zones" "available" {
  state = "available"
}

# tfsec:ignore:aws-ec2-require-vpc-flow-logs-for-all-vpcs
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

# tfsec:ignore:aws-ec2-no-public-ip-subnet
resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, var.public_subnet_offset + count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Type = "public"
  })
}

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, var.private_subnet_offset + count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Type = "private"
  })
}

# Single NAT gateway (in the first public subnet) for all private subnets --
# matches the existing cost-conscious design (one NAT per VPC, not one per AZ).
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-nat-eip" })
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(var.tags, { Name = "${var.name_prefix}-nat" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name_prefix}-private-rt" })
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

output "vpc_id" {
  value = aws_vpc.this.id
}

output "cidr_block" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_route_table_id" {
  value = aws_route_table.public.id
}

output "private_route_table_id" {
  value = aws_route_table.private.id
}

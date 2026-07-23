# GitLab's network home. Previously this only existed when
# terraform.workspace == "production" (vpc_management_prod.tf) --
# always-on now, since GitLab itself is always-on and independent of
# which app environment exists.

module "management_vpc" {
  source = "../modules/vpc"

  name_prefix = "privacyready-management"
  cidr_block  = "10.2.0.0/16"
  az_count    = 2
  tags        = merge(local.tags, { Environment = "management" })
}

resource "aws_ec2_instance_connect_endpoint" "management" {
  subnet_id          = module.management_vpc.private_subnet_ids[0]
  security_group_ids = [aws_security_group.eice.id]

  tags = merge(local.tags, { Name = "privacyready-eice" })
}

resource "aws_security_group" "eice" {
  name_prefix = "privacyready-eice-"
  vpc_id      = module.management_vpc.vpc_id
  description = "EC2 Instance Connect Endpoint SG"

  egress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [module.management_vpc.cidr_block]
  }

  tags = merge(local.tags, { Name = "privacyready-eice-sg" })
}

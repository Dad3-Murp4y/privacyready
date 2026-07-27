# SES domain identity and inbound email forwarding. Kept persistent on
# purpose (explicit requirement) -- re-verifying a domain in SES and
# waiting for production-access approval takes real time, so this
# should never be destroyed as a side effect of tearing down an app
# environment.

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.${aws_ses_domain_identity.main.id}"
  type    = "TXT"
  ttl     = "600"
  records = [aws_ses_domain_identity.main.verification_token]
}

resource "aws_route53_record" "ses_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = "600"
  records = ["10 inbound-smtp.${var.region}.amazonaws.com"]
}

# Inbound mail (hello@/support@/etc) forwarded to an SNS topic
# subscribed by a real inbox, since there's no dedicated support
# mailbox system.
# tfsec:ignore:AVD-AWS-0136
resource "aws_sns_topic" "email_forwarding" {
  name              = "privacyready-email-forwarding"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_policy" "email_forwarding_policy" {
  arn = aws_sns_topic.email_forwarding.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.email_forwarding.arn
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "all_privacyready" {
  topic_arn = aws_sns_topic.email_forwarding.arn
  protocol  = "email"
  endpoint  = "all.datawai@gmail.com"
}

# Verify the team's email so that SES can send to it while still in Sandbox mode
resource "aws_ses_email_identity" "team_sandbox_recipient" {
  email = "all.datawai@gmail.com"
}

resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "privacyready-inbound-ruleset"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

resource "aws_ses_receipt_rule" "forward" {
  name          = "forward-to-sns"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients = [
    "hello@${var.domain_name}",
    "support@${var.domain_name}",
    "sales@${var.domain_name}",
    "security@${var.domain_name}",
    "jobs@${var.domain_name}",
    "christian.watts@${var.domain_name}",
    "admin@${var.domain_name}"
  ]
  enabled      = true
  scan_enabled = true

  sns_action {
    position  = 1
    topic_arn = aws_sns_topic.email_forwarding.arn
    encoding  = "UTF-8"
  }
}

resource "aws_security_group" "ses_bounce_lambda" {
  name_prefix = "privacyready-ses-bounce-"
  vpc_id      = module.management_vpc.vpc_id
  description = "SES Bounce Lambda security group"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "privacyready-ses-bounce-sg" })
}

/*
data "aws_secretsmanager_secret" "prod_db" {
  name = "privacyready/db-password"
}

data "aws_secretsmanager_secret_version" "prod_db" {
  secret_id = data.aws_secretsmanager_secret.prod_db.id
}

data "aws_db_instance" "prod_db" {
  db_instance_identifier = "privacyready-db"
}

module "ses_bounce_handler" {
  source = "../modules/ses_bounce_handler"
  domain_name = var.domain_name
  database_url = "postgresql://privacyready_admin:${data.aws_secretsmanager_secret_version.prod_db.secret_string}@${data.aws_db_instance.prod_db.endpoint}/privacyready?sslmode=require"
  vpc_subnet_ids = module.management_vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.ses_bounce_lambda.id]
}
*/

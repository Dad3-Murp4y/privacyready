# SES domain identity and inbound email forwarding. Kept persistent on
# purpose (explicit requirement) -- re-verifying a domain in SES and
# waiting for production-access approval takes real time, so this
# should never be destroyed as a side effect of tearing down an app
# environment.

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey"
  type    = "CNAME"
  ttl     = "600"
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = "600"
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = "600"
  records = ["v=DMARC1; p=none; rua=mailto:admin@privacyready.co.uk"]
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


# S3 Bucket for temporary storage of inbound raw emails
# tfsec:ignore:AVD-AWS-0088 tfsec:ignore:AVD-AWS-0089 tfsec:ignore:AVD-AWS-0132
resource "aws_s3_bucket" "inbound_emails" {
  bucket        = "privacyready-inbound-emails-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_lifecycle_configuration" "inbound_emails" {
  bucket = aws_s3_bucket.inbound_emails.id

  rule {
    id     = "delete-after-1-day"
    status = "Enabled"

    filter {}

    expiration {
      days = 1
    }
  }
}

resource "aws_s3_bucket_policy" "inbound_emails" {
  bucket = aws_s3_bucket.inbound_emails.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSESPutObject"
        Effect    = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.inbound_emails.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# IAM Role & Policy for Email Forwarder Lambda
resource "aws_iam_role" "ses_email_forwarder" {
  name = "privacyready-ses-email-forwarder-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "ses_email_forwarder" {
  name        = "privacyready-ses-email-forwarder-policy"
  description = "Permissions for SES email forwarder Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.inbound_emails.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ses_email_forwarder" {
  role       = aws_iam_role.ses_email_forwarder.name
  policy_arn = aws_iam_policy.ses_email_forwarder.arn
}

data "archive_file" "ses_email_forwarder" {
  type        = "zip"
  source_file = "${path.module}/lambda/email_forwarder.py"
  output_path = "${path.module}/lambda/email_forwarder.zip"
}

resource "aws_lambda_function" "ses_email_forwarder" {
  filename         = data.archive_file.ses_email_forwarder.output_path
  function_name    = "privacyready-email-forwarder"
  role             = aws_iam_role.ses_email_forwarder.arn
  handler          = "email_forwarder.lambda_handler"
  source_code_hash = data.archive_file.ses_email_forwarder.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  environment {
    variables = {
      FORWARD_TO     = "all.datawai@gmail.com"
      SENDER_DOMAIN  = var.domain_name
      S3_BUCKET_NAME = aws_s3_bucket.inbound_emails.id
    }
  }
}

resource "aws_lambda_permission" "allow_ses_forwarder" {
  statement_id   = "AllowExecutionFromSES"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.ses_email_forwarder.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
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
    var.domain_name
  ]
  enabled      = true
  scan_enabled = true

  s3_action {
    position          = 1
    bucket_name       = aws_s3_bucket.inbound_emails.id
    object_key_prefix = "inbound/"
  }

  lambda_action {
    position        = 2
    function_arn    = aws_lambda_function.ses_email_forwarder.arn
    invocation_type = "Event"
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

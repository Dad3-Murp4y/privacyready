# Email Forwarding Infrastructure
# Forwards specific incoming emails to an SNS topic subscribed by all.privacyready@gmail.com

resource "aws_route53_record" "ses_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = "600"
  records = ["10 inbound-smtp.${var.region}.amazonaws.com"]
}

resource "aws_sns_topic" "email_forwarding" {
  name = "privacyready-email-forwarding"
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
  endpoint  = "all.privacyready@gmail.com"
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
    "jobs@${var.domain_name}"
  ]
  enabled      = true
  scan_enabled = true

  sns_action {
    position  = 1
    topic_arn = aws_sns_topic.email_forwarding.arn
    encoding  = "UTF-8"
  }
}

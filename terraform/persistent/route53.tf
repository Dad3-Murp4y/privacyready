# Moved here from environments/production/alb.tf (formerly terraform/alb.tf)
# -- the hosted zone should never go away just because the app
# environment is being rebuilt.

resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "PrivacyReady public DNS zone"
  tags    = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Allow Route 53 DNSSEC Service"
        Action = [
          "kms:DescribeKey",
          "kms:GetPublicKey",
          "kms:Sign",
        ]
        Effect = "Allow"
        Principal = {
          Service = "dnssec-route53.amazonaws.com"
        }
        Resource = "*"
      },
      {
        Sid    = "Enable IAM User Permissions"
        Action = "kms:*"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Resource = "*"
      },
    ]
  })
}

resource "aws_route53_key_signing_key" "main" {
  hosted_zone_id             = aws_route53_zone.main.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                        = "privacyready-dnssec"
}

resource "aws_route53_hosted_zone_dnssec" "main" {
  depends_on = [
    aws_route53_key_signing_key.main
  ]
  hosted_zone_id = aws_route53_key_signing_key.main.hosted_zone_id
}

resource "aws_route53_health_check" "api" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = { Name = "privacyready-api-health" }
}

# tfsec:ignore:AVD-AWS-0136
resource "aws_sns_topic" "alerts" {
  name              = "privacyready-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "health_check" {
  alarm_name          = "privacyready-api-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "Route 53 API Health Check Failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    HealthCheckId = aws_route53_health_check.api.id
  }
}

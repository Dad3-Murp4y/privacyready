locals {
  common_tags = merge(var.tags, {
    Component = "waf"
  })
}

resource "aws_wafv2_web_acl" "this" {
  name  = "${var.name}-regional"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitByIp"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = var.rate_limit
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
      metric_name                = "${var.name}RateLimit"
      sampled_requests_enabled   = var.sampled_requests_enabled
    }
  }

  dynamic "rule" {
    for_each = var.enable_aws_managed_common_rules ? [true] : []

    content {
      name     = "AWSManagedRulesCommonRuleSet"
      priority = 10

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesCommonRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
        metric_name                = "${var.name}CommonRules"
        sampled_requests_enabled   = var.sampled_requests_enabled
      }
    }
  }

  dynamic "rule" {
    for_each = var.enable_known_bad_inputs_rules ? [true] : []

    content {
      name     = "AWSManagedRulesKnownBadInputsRuleSet"
      priority = 20

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesKnownBadInputsRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
        metric_name                = "${var.name}KnownBadInputs"
        sampled_requests_enabled   = var.sampled_requests_enabled
      }
    }
  }

  dynamic "rule" {
    for_each = var.enable_ip_reputation_rules ? [true] : []

    content {
      name     = "AWSManagedRulesAmazonIpReputationList"
      priority = 30

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesAmazonIpReputationList"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
        metric_name                = "${var.name}IpReputation"
        sampled_requests_enabled   = var.sampled_requests_enabled
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = var.cloudwatch_metrics_enabled
    metric_name                = "${var.name}WebAcl"
    sampled_requests_enabled   = var.sampled_requests_enabled
  }

  tags = merge(local.common_tags, {
    Name = "${var.name}-regional"
  })
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}

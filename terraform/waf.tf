# AWS WAFv2 Regional Web ACL to protect endpoints from DDoS and unauthorized geo-access
resource "aws_wafv2_web_acl" "main" {
  name        = "privacyready-gdpr-waf"
  description = "WAF rules for PrivacyReady GDPR compliance"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  # NOTE: a country allow-list rule used to live here (only TH/GB/SG/US
  # could reach the site at all) -- leftover from the DataWai (Thailand)
  # setup this was originally copied from. PrivacyReady is a UK B2B SaaS
  # product with a global prospect/customer base, so blocking most of
  # the world by default was actively costing business. Removed in
  # favor of the rate limiting and bot control rules below, which
  # provide abuse protection without blocking legitimate visitors by
  # geography. If you want geo-blocking for a specific reason (e.g.
  # sanctioned countries), add a narrow deny-list rule instead of an
  # allow-list.

  rule {
    name     = "AWSManagedRulesBotControlRuleSet"
    priority = 3
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesBotControlRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesBotControlRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 4
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
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "privacyready-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

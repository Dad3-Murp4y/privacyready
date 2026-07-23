# Adapted from the original monitoring.tf: SES domain verification,
# the alerts SNS topic, and the Route53 health check all moved to
# persistent/route53.tf and persistent/ses.tf (domain-level concerns,
# not per-environment). What's left here are the alarms that are
# genuinely specific to this environment's own ECS/ALB/RDS resources.
#
# NOTE: api_cpu below and ecs.tf's high_cpu alarm are both preserved
# from the original -- they overlap (different thresholds/periods)
# but that duplication existed in the source code before this
# refactor, not introduced by it. Worth consolidating at some point,
# didn't do it silently here.

resource "aws_cloudwatch_metric_alarm" "api_cpu" {
  alarm_name          = "privacyready-api-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "120"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors API ECS CPU utilization"
  alarm_actions       = [local.alerts_sns_topic_arn]
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "privacyready-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High number of 5xx errors from the ALB"
  alarm_actions       = [local.alerts_sns_topic_arn]
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "privacyready-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000000000" # 5GB
  alarm_description   = "RDS free storage is below 5GB"
  alarm_actions       = [local.alerts_sns_topic_arn]
  dimensions = {
    DBInstanceIdentifier = module.rds.identifier
  }
}

output "alarm_names" {
  value = merge({
    alb_5xx           = aws_cloudwatch_metric_alarm.alb_5xx.alarm_name
    target_unhealthy  = aws_cloudwatch_metric_alarm.target_unhealthy.alarm_name
    api_running_tasks = aws_cloudwatch_metric_alarm.api_running_tasks.alarm_name
    rds_cpu           = aws_cloudwatch_metric_alarm.rds_cpu.alarm_name
    rds_free_storage  = aws_cloudwatch_metric_alarm.rds_free_storage.alarm_name
    }, var.enable_scanner_alarm ? {
    scanner_running_tasks = aws_cloudwatch_metric_alarm.scanner_running_tasks[0].alarm_name
  } : {})
  description = "Alarm names keyed by logical alarm name."
}

output "alarm_arns" {
  value = merge({
    alb_5xx           = aws_cloudwatch_metric_alarm.alb_5xx.arn
    target_unhealthy  = aws_cloudwatch_metric_alarm.target_unhealthy.arn
    api_running_tasks = aws_cloudwatch_metric_alarm.api_running_tasks.arn
    rds_cpu           = aws_cloudwatch_metric_alarm.rds_cpu.arn
    rds_free_storage  = aws_cloudwatch_metric_alarm.rds_free_storage.arn
    }, var.enable_scanner_alarm ? {
    scanner_running_tasks = aws_cloudwatch_metric_alarm.scanner_running_tasks[0].arn
  } : {})
  description = "Alarm ARNs keyed by logical alarm name."
}

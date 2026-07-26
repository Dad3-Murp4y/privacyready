data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# tfsec:ignore:AVD-AWS-0136
resource "aws_sns_topic" "ses_notifications" {
  name              = "privacyready-ses-notifications"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_ses_identity_notification_topic" "bounce" {
  topic_arn                = aws_sns_topic.ses_notifications.arn
  notification_type        = "Bounce"
  identity                 = var.domain_name
  include_original_headers = true
}

resource "aws_ses_identity_notification_topic" "complaint" {
  topic_arn                = aws_sns_topic.ses_notifications.arn
  notification_type        = "Complaint"
  identity                 = var.domain_name
  include_original_headers = true
}

resource "aws_iam_role" "lambda_exec" {
  name = "privacyready-ses-bounce-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = length(var.vpc_subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# tfsec:ignore:aws-lambda-enable-tracing
resource "aws_lambda_function" "bounce_handler" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "privacyready-ses-bounce-handler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      DATABASE_URL = var.database_url
    }
  }

  dynamic "vpc_config" {
    for_each = length(var.vpc_subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.vpc_subnet_ids
      security_group_ids = var.vpc_security_group_ids
    }
  }
}

resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bounce_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.ses_notifications.arn
}

resource "aws_sns_topic_subscription" "lambda" {
  topic_arn = aws_sns_topic.ses_notifications.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.bounce_handler.arn
}

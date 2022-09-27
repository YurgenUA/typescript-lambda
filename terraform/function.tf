resource "aws_lambda_function" "saleable_function" {
  filename      = data.archive_file.dummy.output_path
  function_name = local.saleable_function_name
  description   = "Create saleable units/component from baseline"
  role          = aws_iam_role.saleable_lambda_role.arn
  handler       = "dist/index.handler"
  runtime       = "nodejs12.x"
  timeout       = var.function_timeout
  depends_on    = [aws_cloudwatch_log_group.saleable_function_log_group]

  reserved_concurrent_executions = var.reserved_concurrent_executions

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      AWS_STAGE    = terraform.workspace,
      OUTPUT_TOPIC = aws_sns_topic.accommodation_saleable_topic.arn
      SQS_DLQ      = aws_sqs_queue.accommodation_saleable_dlq.id
      DB_NAME      = "product-database"
      TIMEOUT      = var.function_timeout
    }
  }

  vpc_config {
    subnet_ids         = data.terraform_remote_state.vpc_internal.outputs.private_subnet_ids
    security_group_ids = [data.terraform_remote_state.vpc_internal.outputs.common_sg_id]
  }

  tags = merge(local.default_tags, {
    Name = local.saleable_function_name
  })
}

resource "aws_lambda_event_source_mapping" "saleable_sqs_subscription" {
  batch_size       = 1
  event_source_arn = aws_sqs_queue.accommodation_saleable_queue.arn
  function_name    = aws_lambda_function.saleable_function.arn
}

resource "aws_lambda_permission" "allows_sqs_to_trigger_saleable_lambda" {
  statement_id  = "AllowExecutionFromSQS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.saleable_function.function_name
  principal     = "sqs.amazonaws.com"
  source_arn    = aws_sqs_queue.accommodation_saleable_queue.arn
}

resource "aws_cloudwatch_log_group" "saleable_function_log_group" {
  name              = "/aws/lambda/${local.saleable_function_name}"
  retention_in_days = 30

  tags = merge(local.default_tags, {
    Name = "${local.saleable_function_name}-log-group"
  })
}

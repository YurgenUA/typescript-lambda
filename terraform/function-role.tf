resource "aws_iam_role" "saleable_lambda_role" {
  name               = "${local.saleable_function_name}-role"
  path               = "/"
  description        = "Application role for ${local.saleable_function_name}"
  assume_role_policy = data.aws_iam_policy_document.saleable_assume_role_policy_document.json

  tags = merge(local.default_tags, {
    Name = "${local.saleable_function_name}-iam-role"
  })
}

data "aws_iam_policy_document" "saleable_assume_role_policy_document" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "saleable_lambda_vpc_execution_policy" {
  role       = aws_iam_role.saleable_lambda_role.id
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Attach a policy required to trigger lambda execution by SQS
data "aws_iam_policy_document" "sqs_to_saleable_lambda" {
  statement {
    effect = "Allow"

    actions = [
      "sqs:DeleteMessage",
      "sqs:ReceiveMessage",
      "sqs:GetQueueAttributes"
    ]

    resources = [aws_sqs_queue.accommodation_saleable_queue.arn]
  }
}

resource "aws_iam_policy" "sqs_to_saleable_lambda_policy" {
  name   = "${local.saleable_function_name}-sqs"
  policy = data.aws_iam_policy_document.sqs_to_saleable_lambda.json
}

resource "aws_iam_policy_attachment" "sqs_to_saleable_lambda_attachment" {
  name       = "${local.saleable_function_name}-sqs"
  roles      = [aws_iam_role.saleable_lambda_role.name]
  policy_arn = aws_iam_policy.sqs_to_saleable_lambda_policy.arn
}

# Attach a policy required for lambda to send to SNS
data "aws_iam_policy_document" "saleable_lambda_to_sns" {
  statement {
    effect  = "Allow"
    actions = ["sns:Publish"]

    resources = [aws_sns_topic.accommodation_saleable_topic.arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [data.terraform_remote_state.encryption.outputs.internal_encryption_key_arn]
  }
}

resource "aws_iam_policy" "saleable_lambda_to_sns_policy" {
  name   = "${local.saleable_function_name}-sns"
  policy = data.aws_iam_policy_document.saleable_lambda_to_sns.json
}

resource "aws_iam_policy_attachment" "saleable_lambda_sns_to_attachment" {
  name       = "${local.saleable_function_name}-sns"
  roles      = [aws_iam_role.saleable_lambda_role.name]
  policy_arn = aws_iam_policy.saleable_lambda_to_sns_policy.arn
}

# Attach X-Ray policy
resource "aws_iam_role_policy_attachment" "saleable_lambda_xray" {
  role       = aws_iam_role.saleable_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
}

# Attach a policy required for lambda to get value from secret manager
data "aws_iam_policy_document" "saleable_get_value_from_secret_manager" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]

    resources = [data.terraform_remote_state.product_storage.outputs.aws_secretsmanager_secret_arn]
  }
}

resource "aws_iam_policy" "saleable_get_value_from_secret_manager_policy" {
  name   = "${local.saleable_function_name}-ssm"
  policy = data.aws_iam_policy_document.saleable_get_value_from_secret_manager.json
}

resource "aws_iam_policy_attachment" "saleable_get_value_from_secret_manager_attachment" {
  name       = "${local.saleable_function_name}-ssm"
  roles      = [aws_iam_role.saleable_lambda_role.name]
  policy_arn = aws_iam_policy.saleable_get_value_from_secret_manager_policy.arn
}

# Attach a policy required for lambda to send to DLG SQS
data "aws_iam_policy_document" "saleable_lambda_to_dlg_sqs" {
  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.accommodation_saleable_dlq.arn]
  }
}

resource "aws_iam_policy" "saleable_lambda_to_dlq_sqs_policy" {
  name   = "${local.saleable_function_name}-dlq-sqs"
  policy = data.aws_iam_policy_document.saleable_lambda_to_dlg_sqs.json
}

resource "aws_iam_policy_attachment" "saleable_lambda_dlq_sqs_to_attachment" {
  name       = "${local.saleable_function_name}-dlq-sqs"
  roles      = [aws_iam_role.saleable_lambda_role.name]
  policy_arn = aws_iam_policy.saleable_lambda_to_dlq_sqs_policy.arn
}


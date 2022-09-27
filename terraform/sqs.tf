#Saleable queue
resource "aws_sqs_queue" "accommodation_saleable_queue" {
  name                       = "${var.service}-${terraform.workspace}-${var.sourcing}-saleable"
  kms_master_key_id          = data.terraform_remote_state.encryption.outputs.internal_encryption_key_arn
  visibility_timeout_seconds = 600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.accommodation_saleable_dlq.arn
    maxReceiveCount     = 5
  })

  tags = merge(local.default_tags, {
    Name = "${local.saleable_function_name}-sqs"
  })
}

resource "aws_sns_topic_subscription" "accommodation_saleable_topic_sqs_subscription" {
  endpoint             = aws_sqs_queue.accommodation_saleable_queue.arn
  protocol             = "sqs"
  raw_message_delivery = true
  topic_arn            = data.terraform_remote_state.accommodation_saleable_geo_enricher.outputs.accommodation_saleable_geo_enriched_topic
}

resource "aws_sqs_queue_policy" "saleable_sqs_queue_policy" {
  queue_url = aws_sqs_queue.accommodation_saleable_queue.id
  policy    = data.aws_iam_policy_document.saleable_sqs_queue_policy_document.json
}

data "aws_iam_policy_document" "saleable_sqs_queue_policy_document" {
  statement {
    effect  = "Allow"
    actions = [
      "sqs:SendMessage"
    ]

    principals {
      identifiers = ["*"]
      type        = "*"
    }

    resources = [aws_sqs_queue.accommodation_saleable_queue.arn]

    condition {
      test     = "ArnEquals"
      values   = [
        data.terraform_remote_state.accommodation_saleable_geo_enricher.outputs.accommodation_saleable_geo_enriched_topic]
      variable = "aws:SourceArn"
    }
  }
}

resource "aws_sqs_queue" "accommodation_saleable_dlq" {
  name = "${var.service}-${terraform.workspace}-${var.sourcing}-saleable-dlq"
  kms_master_key_id = data.terraform_remote_state.encryption.outputs.internal_encryption_key_arn

  tags = merge(local.default_tags, {
    Name = "${local.saleable_function_name}-sqs-dlq"
  })
}

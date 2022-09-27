resource "aws_sns_topic" "accommodation_saleable_topic" {
  name              = "${var.service}-${terraform.workspace}-${var.sourcing}-saleable-topic"
  display_name      = "Persisted accommodation saleable units/component ready for further processing"
  kms_master_key_id = data.terraform_remote_state.encryption.outputs.internal_encryption_key_arn


  tags = merge(local.default_tags, {
    Name = "${local.saleable_function_name}-sns"
  })
}

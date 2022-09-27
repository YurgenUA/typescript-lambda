# Terraform doesn't support interpolation in backend section
terraform {
  backend "s3" {
    bucket         = "product-terraform-s3-backend-state"
    dynamodb_table = "terraform-state-locks"
    encrypt        = "true"
    key            = "product/accommodation-saleable/terraform.tfstate"
    region         = "eu-central-1"
    role_arn       = "arn:aws:iam::473519880290:role/terraform"
  }
}

resource "null_resource" "workspace_check" {
  count = terraform.workspace == "default" ? 1 : 0
  provisioner "local-exec" {
    command = <<EOF
      echo   "ERROR: You can't use default workspace, please specify different one"
      exit -1
EOF
  }

  triggers = {
    timestamp = timestamp()
  }
}

data "terraform_remote_state" "vpc_internal" {
  backend   = "s3"
  workspace = terraform.workspace
  config    = {
    bucket   = "product-terraform-s3-backend-state"
    key      = "product-terraform/networking/vpc-internal/terraform.tfstate"
    region   = "eu-central-1"
    role_arn = "arn:aws:iam::473519880290:role/terraform"
  }
}

data "terraform_remote_state" "accommodation_saleable_geo_enricher" {
  backend   = "s3"
  workspace = terraform.workspace
  config    = {
    bucket   = "product-terraform-s3-backend-state"
    key      = "product/accommodation-saleable-geo-enricher/terraform.tfstate"
    region   = "eu-central-1"
    role_arn = "arn:aws:iam::473519880290:role/terraform"
  }
}

data "terraform_remote_state" "product_storage" {
  backend   = "s3"
  workspace = terraform.workspace
  config    = {
    bucket   = "product-terraform-s3-backend-state"
    key      = "product-terraform/storage/terraform.tfstate"
    region   = "eu-central-1"
    role_arn = "arn:aws:iam::473519880290:role/terraform"
  }
}

data "terraform_remote_state" "encryption" {
  backend   = "s3"
  workspace = terraform.workspace
  config    = {
    bucket   = "product-terraform-s3-backend-state"
    key      = "product-terraform/encryption/terraform.tfstate"
    region   = "eu-central-1"
    role_arn = "arn:aws:iam::473519880290:role/terraform"
  }
}

# Used for initial (empty) lambda provisioning
data "archive_file" "dummy" {
  type        = "zip"
  output_path = "${path.module}/dummy.zip"

  source {
    content  = "hello"
    filename = "dummy.txt"
  }
}

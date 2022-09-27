locals {
  saleable_function_name = "${var.service}-${terraform.workspace}-${var.sourcing}-saleable"

  default_tags = {
    Contact         = "Product Team",
    BusinessUnit    = "Product",
    business_domain = "Product",
    Application     = "TUI Product",
    Env             = upper(terraform.workspace),
    Service         = local.saleable_function_name,
    map-migrated    = "d-server-02ifemhooybar6"
  }
}

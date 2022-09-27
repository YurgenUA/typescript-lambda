variable "region" {
  default     = "eu-central-1"
  type        = string
  description = "Region, where infrastructure to be deployed, 'eu-central-1' by default"
}

variable "service" {
  default     = "product"
  type        = string
  description = "Service name, 'product' by default"
}

variable "sourcing" {
  default     = "ac"
  type        = string
  description = "Sourcing service name, 'ac' that stands for 'accommodation' by default"
}

variable "assume_role_arn" {
  type        = string
  description = "Target environment role"
}

variable "log_level" {
  type        = string
  description = "Defines logging severity level."
}

variable "reserved_concurrent_executions" {
  type        = number
  description = "Reserved concurrent executions for function"
  default     = -1
}

variable "function_timeout" {
  description = "Lambda function timeout"
  type        = string
  default     = "100"
}
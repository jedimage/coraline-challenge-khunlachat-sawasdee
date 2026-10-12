variable "project_id" {
  description = "Existing Google Cloud project with billing enabled."
  type        = string
}
variable "region" {
  type    = string
  default = "asia-southeast1"
}
variable "zone" {
  type    = string
  default = "asia-southeast1-b"
}
variable "name_prefix" {
  type    = string
  default = "metabase"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,14}$", var.name_prefix))
    error_message = "Use 1–15 lowercase letters, digits or hyphens, starting with a letter."
  }
}
variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,7}$", var.environment))
    error_message = "Use 2–8 lowercase letters or digits, starting with a letter."
  }
}
variable "subnet_cidr" {
  description = "VM subnet CIDR; must not overlap the private services range."
  type        = string
  default     = "10.20.0.0/24"
  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "Supply an IPv4 CIDR."
  }
}
variable "private_services_cidr" {
  description = "Dedicated, non-overlapping Private Services Access allocation."
  type        = string
  default     = "10.30.0.0/16"
  validation {
    condition     = can(cidrnetmask(var.private_services_cidr))
    error_message = "Supply an IPv4 CIDR."
  }
}
variable "machine_type" {
  type    = string
  default = "e2-medium"
}
variable "boot_disk_size_gb" {
  type    = number
  default = 20
}
variable "database_edition" {
  description = "Choose a tier supported by this edition and region."
  type        = string
  default     = "ENTERPRISE"
  validation {
    condition     = contains(["ENTERPRISE", "ENTERPRISE_PLUS"], var.database_edition)
    error_message = "Use ENTERPRISE or ENTERPRISE_PLUS."
  }
}
variable "database_tier" {
  description = "Enterprise dedicated-core baseline: 1 vCPU / 3.75 GiB RAM."
  type        = string
  default     = "db-custom-1-3840"
}
variable "database_disk_size_gb" {
  type    = number
  default = 10
}
variable "database_deletion_protection" {
  description = "Terraform deletion guard; disable and apply deliberately before destroy."
  type        = bool
  default     = true
}
variable "database_name" {
  type    = string
  default = "metabase"
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,62}$", var.database_name))
    error_message = "Use a lowercase SQL identifier up to 63 characters."
  }
}
variable "database_user" {
  type    = string
  default = "metabase"
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,62}$", var.database_user)) && var.database_user != "postgres"
    error_message = "Use a dedicated lowercase SQL username, not postgres."
  }
}
variable "domain_name" {
  description = "Real DNS hostname you control; no scheme, path or trailing dot."
  type        = string
  validation {
    condition     = length(var.domain_name) <= 253 && can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,63}$", var.domain_name))
    error_message = "Supply a lowercase DNS hostname such as metabase.example.com."
  }
}
variable "metabase_image" {
  description = "Official Metabase OSS Docker image pinned to an explicit release tag."
  type        = string
  default     = "metabase/metabase:v0.60.27"
  validation {
    condition     = can(regex("^metabase/metabase:v0\\.[0-9]+\\.[0-9]+(\\.[0-9]+)?$", var.metabase_image))
    error_message = "Use an explicit official OSS release, e.g. metabase/metabase:v0.60.27 (no latest or floating tags)."
  }
}

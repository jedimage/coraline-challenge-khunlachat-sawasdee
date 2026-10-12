resource "random_password" "database" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "main" {
  name                = "${local.name}-db"
  region              = var.region
  database_version    = "POSTGRES_18"
  deletion_protection = var.database_deletion_protection
  settings {
    edition           = var.database_edition
    tier              = var.database_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.database_disk_size_gb
    disk_autoresize   = true
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }
  }
  depends_on = [google_service_networking_connection.private_services]
}

resource "google_sql_database" "metabase" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "metabase" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = random_password.database.result
}

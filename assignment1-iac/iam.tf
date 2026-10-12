resource "google_service_account" "metabase" {
  account_id   = "${local.name}-vm"
  display_name = "Metabase VM runtime"
  depends_on   = [google_project_service.required]
}

resource "google_secret_manager_secret" "database_password" {
  secret_id = "${local.name}-db-password"
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = random_password.database.result
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  secret_id = google_secret_manager_secret.database_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.metabase.email}"
}

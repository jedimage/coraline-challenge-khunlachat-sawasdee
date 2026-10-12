resource "google_compute_instance_template" "metabase" {
  name_prefix  = "${local.name}-"
  machine_type = var.machine_type
  tags         = ["${local.name}-app"]
  disk {
    source_image = "projects/debian-cloud/global/images/family/debian-12"
    boot         = true
    auto_delete  = true
    disk_type    = "pd-balanced"
    disk_size_gb = var.boot_disk_size_gb
  }
  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    # No access_config: VM has no public IP.
  }
  service_account {
    email  = google_service_account.metabase.email
    scopes = ["cloud-platform"]
  }
  metadata = {
    block-project-ssh-keys = "true"
  }
  metadata_startup_script = templatefile("${path.module}/scripts/startup.sh.tftpl", {
    secret_id  = google_secret_manager_secret.database_password.secret_id
    project_id = var.project_id
    db_host    = google_sql_database_instance.main.private_ip_address
    db_name    = var.database_name
    db_user    = var.database_user
    image      = var.metabase_image
    site_url   = "https://${var.domain_name}"
  })
  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_instance_group_manager" "metabase" {
  name               = "${local.name}-mig"
  base_instance_name = local.name
  zone               = var.zone
  target_size        = 1
  version {
    instance_template = google_compute_instance_template.metabase.id
  }
  named_port {
    name = "http"
    port = 3000
  }
  auto_healing_policies {
    health_check      = google_compute_health_check.metabase.id
    initial_delay_sec = 900
  }
  # Replace in place to avoid running two application instances during upgrades.
  update_policy {
    type                  = "PROACTIVE"
    minimal_action        = "REPLACE"
    replacement_method    = "RECREATE"
    max_surge_fixed       = 0
    max_unavailable_fixed = 1
  }
  depends_on = [
    google_secret_manager_secret_version.database_password,
    google_secret_manager_secret_iam_member.runtime,
    google_sql_database.metabase,
    google_sql_user.metabase,
    google_compute_router_nat.main,
    google_compute_firewall.load_balancer,
  ]
  lifecycle {
    precondition {
      condition     = startswith(var.zone, "${var.region}-")
      error_message = "zone must belong to region."
    }
  }
}

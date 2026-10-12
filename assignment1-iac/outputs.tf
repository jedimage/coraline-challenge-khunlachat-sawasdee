output "load_balancer_ip" {
  description = "Create the domain's DNS A record with this address."
  value       = google_compute_global_address.load_balancer.address
}
output "app_https_url" {
  description = "Usable after DNS propagation, certificate activation and backend readiness."
  value       = "https://${var.domain_name}"
}
output "cloud_sql_private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}
output "instance_group_id" {
  value = google_compute_instance_group_manager.metabase.instance_group
}
output "database_password_secret_id" {
  value = google_secret_manager_secret.database_password.id
}

resource "google_compute_health_check" "metabase" {
  name                = "${local.name}-health"
  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 2
  unhealthy_threshold = 5
  http_health_check {
    port         = 3000
    request_path = "/api/health"
  }
  depends_on = [google_project_service.required]
}

resource "google_compute_global_address" "load_balancer" {
  name       = "${local.name}-lb-ip"
  depends_on = [google_project_service.required]
}

resource "google_compute_backend_service" "metabase" {
  name                  = "${local.name}-backend"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 60
  health_checks         = [google_compute_health_check.metabase.id]
  backend {
    group = google_compute_instance_group_manager.metabase.instance_group
  }
}

resource "google_compute_url_map" "metabase" {
  name            = "${local.name}-https"
  default_service = google_compute_backend_service.metabase.id
}

resource "google_compute_managed_ssl_certificate" "metabase" {
  name = "${local.name}-certificate"
  managed {
    domains = [var.domain_name]
  }
  depends_on = [google_project_service.required]
}

resource "google_compute_target_https_proxy" "metabase" {
  name             = "${local.name}-https"
  url_map          = google_compute_url_map.metabase.id
  ssl_certificates = [google_compute_managed_ssl_certificate.metabase.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${local.name}-https"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.load_balancer.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.metabase.id
}

resource "google_compute_url_map" "redirect" {
  name = "${local.name}-redirect"
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
  depends_on = [google_project_service.required]
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${local.name}-redirect"
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${local.name}-http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.load_balancer.address
  ip_protocol           = "TCP"
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect.id
}

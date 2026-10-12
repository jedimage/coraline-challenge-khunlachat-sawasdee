# Metabase on Google Cloud with Terraform

## Objective
Implement a minimal, understandable, deployable infrastructure for a Metabase application using Docker on Google Compute Engine, backed by Cloud SQL for PostgreSQL 18. The application must be accessible through a working HTTPS endpoint. Infrastructure must be provisioned with Terraform, database must be private-only, and sensitive credentials must be managed securely.

**Design principle:** Do not overengineer. Use a GCE Managed Instance Group (MIG), **not** GKE. Use an ordinary supported Debian 12 image and a GCE startup script; **do not build a custom image, use Packer, or add an Artifact Registry merely to host the Metabase image**. Docker image can be pulled from the official Metabase registry with a configurable, pinned version.

## Target architecture

```text
Internet (users)
      |
      v
Global External HTTPS Application Load Balancer
  - TLS termination, port 443
  - optional port 80 -> HTTPS redirect
  - Google-managed TLS certificate for supplied DNS name
      |
      | HTTP backend protocol, named port 'http' = 3000
      v
Zonal Managed Instance Group (target size 1)
  - instance template: e2-medium (2 vCPU / 4 GiB)
  - Debian 12 base image (no custom VM image)
  - Docker installed by boot startup script
  - Metabase container listening on port 3000
      |
      | Private connectivity (VPC + Private Services Access)
      v
Cloud SQL PostgreSQL 18
  - private IP only; NO public IPv4
  - application database and dedicated database user

Bootstrapping:
GCE startup script -> Secret Manager (DB password) -> docker run Metabase
```

## Required Terraform infrastructure

### 1. Provider and project settings
- Use the official Terraform Google provider and any necessary supporting provider (e.g. `random`).
- All configurable values in `variables.tf`: project ID, region, zone, VPC/subnet CIDR, instance machine type (`e2-medium` default), database tier, DB name, DB username, domain name, Metabase container image/tag and environment-specific naming.
- Provide `terraform.tfvars.example`; do not commit sensitive tfvars, state, keys, or generated secrets.
- Configure required Google APIs with `google_project_service` where appropriate, including Compute Engine, Service Networking, Cloud SQL Admin, and Secret Manager.
- Organize code into readable files; no need for complicated reusable modules for this assignment.

### 2. Networking
- Create a dedicated VPC and subnet in the selected region.
- Establish Private Services Access (allocated private services range + service networking connection) for Cloud SQL private IP, with Terraform dependencies handled correctly.
- Cloud SQL must have `ipv4_enabled = false` and private networking only.
- GCE instances preferably have **no external IP**. If so, provide outbound connectivity for package installation, Metabase Docker image pull and Google APIs via Cloud Router + Cloud NAT (or document a working private API access alternative); keep deployment practical and working.
- Define firewall rules with minimal access: permit TCP 3000 to Metabase VMs **only from the documented source ranges needed for a global external Application Load Balancer and health checks** (for instance, Google's documented ranges for GFE-based backends). Do not open port 3000 to `0.0.0.0/0`.
- Assign VM network tags or equivalent targeting for these rules.

### 3. Database
- Provision `google_sql_database_instance` using `POSTGRES_18`, with a configurable supported, cost-conscious instance tier and edition. Avoid unnecessary HA for the baseline.
- Set private IP only, and apply correct dependency on Private Services Access.
- Create the Metabase application database and dedicated PostgreSQL user (not the built-in `postgres` superuser).
- Generate a strong password via Terraform's random provider and write it to Google Secret Manager as a secret version. The database user's password and secret payload must be exactly the same value.
- Create the secret before application instances start. Add explicit dependencies where needed because the VM is bootstrapped asynchronously.
- **Security note:** Password generation and secret version creation with Terraform can store the password in Terraform state. Do not output it; mark any relevant Terraform output sensitive; document the risk and secure handling of Terraform state (access-controlled backend, no state checked into Git).
- Non-sensitive DB values (`MB_DB_HOST`, `MB_DB_PORT`, `MB_DB_DBNAME`, `MB_DB_USER`, `MB_DB_TYPE`) may be interpolated into the instance startup script from Terraform-managed resources.
- Use the Cloud SQL private IP for `MB_DB_HOST`. GCE and Cloud SQL must have working private network reachability.

### 4. Runtime identity and secret access
- Create a dedicated GCE service account used by the Metabase MIG instance template.
- Grant it `roles/secretmanager.secretAccessor` scoped to **only the Metabase database password secret**, not the whole project.
- Configure VM OAuth scopes to permit API access (`cloud-platform` scope); IAM grants remain narrowly scoped.
- Enable Secret Manager API and ensure no secret contents are interpolated into instance-template metadata or startup script.
- VMs should authenticate to Secret Manager using their attached GCE service account through the metadata identity; no downloaded JSON service-account keys.

### 5. Instance Template and startup script (NO custom image)
- Create a GCE instance template from an ordinary Debian 12 public image family.
- Default machine type `e2-medium` (2 vCPU, 4 GiB RAM).
- Startup script (`scripts/startup.sh.tftpl` or equivalent), templated by Terraform:
  1. Run with safe shell settings (`set -euo pipefail`) and log useful non-sensitive progress.
  2. Install Docker using `apt-get` if not already installed.
  3. Run `systemctl enable --now docker`.
  4. Retrieve `MB_DB_PASS` at VM boot from Google Secret Manager with the VM service account (via `gcloud` if available; otherwise install gcloud explicitly or call the Secret Manager REST API using a metadata-server access token). **Do not assume every Debian image contains gcloud preinstalled**.
  5. Add bounded retries/error handling for transient Secret Manager/API/network readiness failures; fail clearly if unable to retrieve the secret. Avoid printing or exposing the password to startup logs, shell tracing, or command-line arguments.
  6. Run the officially published Metabase Docker image pinned to a configurable specific version, publish container port 3000 on host port 3000, use `--restart unless-stopped`, and pass `MB_DB_TYPE=postgres`, `MB_DB_HOST`, `MB_DB_PORT=5432`, `MB_DB_DBNAME`, `MB_DB_USER`, `MB_DB_PASS`.
  7. Pass the password to Docker without placing the value directly in the `docker run` command argument; exporting it as `MB_DB_PASS` and using `-e MB_DB_PASS` is acceptable for this assignment. `unset` the temporary shell variable after container creation. Document that container environment variables are visible to privileged Docker users.
  8. Make bootstrap **idempotent across VM reboots**: don't launch a conflicting container with the same name on subsequent boots. Let the Docker restart policy handle existing containers.
  9. Ensure the Metabase container is actually running; when configured dependencies are temporarily unavailable, use reasonable retry/health behavior.
- All script inputs except the actual database password may be injected via template variables. NEVER put password itself in instance metadata.

### 6. Managed Instance Group
- Create a **zonal** Managed Instance Group using the instance template, initially one VM.
- Set a named port, `http = 3000`, for the application load balancer backend.
- Configure an appropriate HTTP health check on `:3000/api/health` and MIG autohealing with enough initial delay to accommodate apt installation and image pull.
- Set baseline instance count to 1. **Do not enable multi-instance Metabase autoscaling by default.** Explain that infrastructure can be extended later using an autoscaler and updated instance templates, but validating multi-instance Metabase functionality, its edition/licensing, background jobs and app DB capacity is required first.
- Make MIG creation explicitly depend on secret version availability and the secret IAM binding, as necessary for reliable first boot.

### 7. HTTPS Load Balancer
- Create a global external Application Load Balancer using the appropriate `EXTERNAL_MANAGED` resources.
- Reserve a global external IP, define backend service using the MIG instance group and named port `http` (3000), URL map, HTTPS target proxy, global forwarding rule TCP 443, and health check.
- TLS termination occurs at the load balancer, with HTTP from load balancer to instances on TCP 3000. Document this internal hop is **not end-to-end TLS**.
- Use a Google-managed TLS certificate associated with a supplied real domain name. Include in README the DNS A-record requirement and certificate provisioning delay. Do not claim HTTPS will become active before DNS points to the global LB IP and certificate reaches active status.
- Optional: provision HTTP listener TCP 80 redirecting to HTTPS.
- Health checks must match actual application readiness; configure appropriate timeout/check thresholds and firewall access.

## Provisioning / dependency expectations

```text
Enable required APIs
        |
VPC/Subnet + Private Services Access
        |
Cloud SQL PostgreSQL 18 + application DB + DB user
        |                          \
        |                           Generate password
        |                                   |
        +--------------------------- Secret Manager version
                                            |
                                Secret-scoped IAM binding
                                            |
                                  GCE instance template
                                            |
                                    Zonal MIG (size=1)
                                            |
                                   GCE startup/bootstrap
                                            |
                         Secret Manager fetch -> Docker Metabase
                                            |
                              Health check -> HTTPS Load Balancer
```

**Note:** This diagram is a logical dependency flow, not a requirement that all unrelated Terraform resources be serialized. Terraform should infer normal dependencies from references and use explicit `depends_on` only where needed. Load balancer infrastructure can be created while application instances initialize.

## Repository deliverables

```text
.
├── requirement.md
├── README.md
├── versions.tf
├── providers.tf
├── variables.tf
├── terraform.tfvars.example
├── main.tf            # or split logically into network/sql/compute/lb/iam
├── outputs.tf
├── scripts/
│   └── startup.sh.tftpl
└── .gitignore
```

- `README.md` must cover architecture, why MIG + startup script rather than GKE/custom image, prerequisites, authentication, project/billing/API setup, Terraform commands, configuring DNS and certificate, checking rollout and health, verifying private-only Cloud SQL, secret retrieval troubleshooting, rollback/replacement notes, cost considerations, limitations, and `terraform destroy` cleanup.
- Terraform outputs: global LB IP, app HTTPS URL (once configured), Cloud SQL private IP (non-sensitive), instance group identifier, and Secret Manager secret ID. **Do not output the password.**
- Add simple commands for validating startup logs, `docker ps`, container logs and `/api/health`, without logging secret values.
- Explicitly document startup boot time / repeated image pull as an accepted trade-off against custom image maintenance.

## Acceptance criteria
1. `terraform fmt` and `terraform validate` pass (or identify and document prerequisites preventing verification).
2. `terraform apply` is designed to provision a reachable HTTPS Metabase application using one MIG VM and Cloud SQL PostgreSQL 18 with only a private IP.
3. LB terminates HTTPS on :443 and forwards HTTP on VM :3000; appropriate firewall rules exist.
4. VM can retrieve password using its own service account; no DB password in code, TF vars, instance template or startup metadata.
5. Metabase uses Cloud SQL PostgreSQL as its application database, not the embedded H2 database.
6. README explains all manual DNS/certificate steps and costs.
7. No Kubernetes, no Packer, no pre-baked custom VM image, no unnecessary components.

## Codex implementation instructions
- Generate code, scripts and README from this specification. Prefer direct, straightforward Terraform resources rather than abstract modules.
- Choose provider-valid resource attributes and supported Cloud SQL PostgreSQL 18 edition/tier, checking against current Google provider syntax where needed.
- Pin the Metabase image tag to a real release, not `latest` and not a placeholder.
- If missing project ID, DNS domain or region, expose them as variables with examples rather than inventing real values.
- Pay special attention to cloud API enablement dependencies, Secret Manager readiness, VM internet/API egress, initial bootstrap delay, LB health checks and port name mapping.
- Do not apply or create cloud resources until expressly instructed. Generate, format, validate where possible, then summarize assumptions and any manual steps.

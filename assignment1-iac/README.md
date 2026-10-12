# Assignment 1: Metabase on Google Cloud

This directory provisions a global external HTTPS Application Load Balancer, one Debian 12 VM in a zonal Managed Instance Group (MIG), and private-only Cloud SQL PostgreSQL 18. Terraform does not create a project or manage DNS.

```text
Internet -- HTTPS :443 --> global external Application Load Balancer
                              | TLS termination
                              | HTTP :3000, named port http
                              v
                         zonal MIG (1 VM)
                         Debian 12 / e2-medium
                         Docker / Metabase
                              |
                              | private IP :5432, Private Services Access
                              v
                         Cloud SQL PostgreSQL 18
                         Enterprise / db-custom-1-3840

VM --> Cloud NAT --> Debian packages / official Docker image
VM service account --> Secret Manager --> database password at boot
HTTP :80 --> HTTPS redirect
```

The VM has no external IP. A dedicated VPC, regional subnet, Private Services Access allocation and peering connect the VM to SQL. Cloud Router + Cloud NAT provide internet egress; Private Google Access is also enabled. Only Google's GFE/health-check ranges `35.191.0.0/16` and `130.211.0.0/22` can reach VM port 3000. No inbound SSH rule is created. The VPC's default implied outbound allow rule supplies egress.

MIG plus a startup script meets the assignment without Kubernetes, Packer, custom images, or an extra image registry. Every new/replacement VM installs Docker and Google Cloud CLI and pulls the pinned official image. Several minutes of bootstrap time and repeated downloads on replacement are accepted trade-offs against custom image maintenance. Reboots preserve the existing container and Docker's restart policy; bootstrap also starts a previously stopped container.

## Files and defaults

- `versions.tf`, `providers.tf`, `main.tf`: provider constraints, project and API enablement.
- `network.tf`, `database.tf`, `iam.tf`, `compute.tf`, `lb.tf`: direct infrastructure resources.
- `variables.tf`, `terraform.tfvars.example`, `outputs.tf`: configuration and non-secret outputs.
- `scripts/startup.sh.tftpl`: package installation, bounded secret retrieval and container readiness checks.

Defaults are `asia-southeast1` / `asia-southeast1-b`, `e2-medium`, 20 GB VM disk, SQL Enterprise `db-custom-1-3840` (1 vCPU / 3.75 GiB), 10 GB auto-growing SQL SSD, zonal SQL availability, daily backups and point-in-time recovery. PostgreSQL 18 supports Enterprise; the edition is explicit because newer PostgreSQL versions otherwise default to Enterprise Plus. Change edition and tier together to a supported combination in the chosen region.

The official Metabase OSS image is pinned to `metabase/metabase:v0.60.27`, a published release. Change `metabase_image` to another explicit tested release when updating. The Debian 12 family resolves to Google's current Debian 12 image when instances are created; it is deliberately not a custom image.

## Prerequisites and authentication

1. Terraform >= 1.6 and < 2, Google Cloud CLI, an existing project with billing enabled, and a real DNS hostname you control.
2. Compute/Cloud SQL quota and organization policies allowing the selected region, external load balancer, Cloud NAT and private services peering. Choose non-overlapping subnet and private-services CIDRs, including any connected networks. The zone must belong to the region.
3. A deployment identity authorized to enable services, manage Compute/network/LB resources, establish Service Networking, manage Cloud SQL, create service accounts, attach the runtime service account, and manage Secret Manager secrets/versions/IAM. Typical scoped predefined roles include Service Usage Admin, Compute Admin, Service Networking Admin, Cloud SQL Admin, Service Account Admin, Service Account User and Secret Manager Admin. The runtime VM receives only secret-scoped Secret Accessor; it does not inherit the deployment identity's permissions.
4. Enable Service Usage API in the project first if it is not already available. Terraform enables Compute, Service Networking, SQL Admin, Secret Manager and IAM APIs, and intentionally leaves APIs enabled on destroy.

Authenticate locally (or use your organization's workload identity/impersonation flow):

```bash
cd 1-iac
export PROJECT_ID='your-existing-project-id'
gcloud auth login
gcloud config set project "$PROJECT_ID"
gcloud auth application-default login
gcloud auth application-default set-quota-project "$PROJECT_ID"
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: project_id, real domain_name, and any regional settings.
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=review.tfplan
```

Review the plan. Only when you decide to deploy, run `terraform apply review.tfplan`. No apply was executed while generating this implementation. `apply` can finish before the application or certificate is ready.

Commit `.terraform.lock.hcl` after initialization to retain reviewed provider versions. Do not commit `.terraform/`, state, saved plans, private keys or real tfvars. `.gitignore` includes the common generated/sensitive files.

### State and credentials

Terraform generates one 32-character random password and uses exactly that value for the SQL user and Secret Manager version. The password **is present in Terraform state** and can also be present in saved plans. Sensitive markings suppress routine display, not state storage. No output contains it, and instance metadata includes only the secret ID, project ID and non-sensitive DB configuration.

Before deployment, configure an access-controlled, encrypted remote backend (for example an existing GCS bucket with uniform bucket-level access, public access prevention and versioning), following your organization's state policy. A backend bucket is intentionally not created by this assignment. With no backend block Terraform uses local state: restrict local file access, encrypt the workstation, keep backups secure and never add state/plan files to Git. Move existing state with `terraform init -migrate-state` after adding backend configuration.

The Bash startup script installs Google Cloud CLI from the official Google Cloud APT repository if it is missing, then uses `gcloud secrets versions access latest` with the secret ID and project ID. gcloud automatically authenticates through the attached GCE service account; no interactive login or service-account key files are used. No explicit Python dependency or Python retrieval code is added; APT manages the CLI package’s own dependencies. Secret output is captured in memory, CLI file logging is disabled, and failed access is retried up to 12 times with generic diagnostics. The `latest` version must be enabled and match the SQL password; it does not fall back to an older enabled version. Retries cover IAM/API propagation, and MIG creation waits for the DB/user, secret version, secret IAM and NAT. Password contents are never template inputs. Docker receives `-e MB_DB_PASS` through the process environment, and the script unsets it after container creation. Root and privileged Docker users can inspect container environment variables; treat Docker access as root access. Do not run shell tracing, dump environments or use unrestricted `docker inspect` in shared logs.

## DNS and HTTPS activation

After deployment:

```bash
terraform output load_balancer_ip
terraform output app_https_url
```

Create a public DNS **A** record for `domain_name` pointing to the returned global IPv4 address. Remove conflicting A/AAAA records; no IPv6 frontend is provisioned. If your DNS provider offers proxying, use DNS-only mode during certificate provisioning. Check restrictive CAA records if issuance fails.

```bash
export NAME='metabase-dev' # name_prefix-environment
export DOMAIN='metabase.example.com' # use your real hostname
export ZONE='asia-southeast1-b'
dig +short A "$DOMAIN"
gcloud compute ssl-certificates describe "$NAME-certificate" --global \
  --format='yaml(managed.status,managed.domainStatus)'
gcloud compute backend-services get-health "$NAME-backend" --global
curl -f "https://$DOMAIN/api/health"
curl -I "http://$DOMAIN/"
```

Google-managed certificate activation can take tens of minutes or longer after DNS propagation. HTTPS is usable only after DNS resolves correctly, the certificate is `ACTIVE`, and the backend is healthy. Do not expect HTTPS against the raw IP to validate. Complete Metabase's initial admin setup promptly at the HTTPS URL. Its application DB is PostgreSQL, not embedded H2.

TLS terminates at the load balancer. The backend hop to the VM uses HTTP and is **not end-to-end TLS**. Database traffic uses the private VPC path; this minimal configuration does not enforce database TLS or run Cloud SQL Auth Proxy. Private networking alone is not a TLS guarantee.

## Rollout and troubleshooting

The HTTP health check probes `/api/health` on port 3000 every 30 seconds, with two successes to become healthy and five failures to become unhealthy. MIG autohealing waits 900 seconds initially; readiness is still required before LB traffic. Startup checks local readiness for up to ten minutes after container creation. Docker restarts failed containers; MIG replaces persistently unhealthy VMs. Persistent configuration failures can cause replacement loops: inspect startup logs early. A transient SQL interruption may recover through container restarts; this is not a guarantee of uninterrupted service.

```bash
gcloud compute instance-groups managed list-instances "$NAME-mig" --zone="$ZONE"
export VM='copy-instance-name-from-the-list'
gcloud compute instances get-serial-port-output "$VM" --zone="$ZONE" --port=1
# Verify VM has no public access configuration:
gcloud compute instances describe "$VM" --zone="$ZONE" \
  --format='yaml(networkInterfaces)'
# Should show only a PRIVATE SQL address and ipv4Enabled: false:
gcloud sql instances describe "$NAME-db" \
  --format='yaml(databaseVersion,settings.edition,settings.tier,settings.ipConfiguration,ipAddresses)'
```

For Docker diagnostics, use an authorized existing private management path, or temporarily enable IAP SSH as below. This is an operator troubleshooting step, not part of the baseline infrastructure. Your operator needs IAP-secured Tunnel User, appropriate Compute instance/SSH metadata permissions and permission to act as the attached service account. Organization-enforced OS Login additionally requires the appropriate OS Login role. These operator permissions are separate from the VM's secret role.

```bash
gcloud services enable iap.googleapis.com
gcloud compute firewall-rules create "$NAME-debug-ssh" \
  --network="$NAME-vpc" --allow=tcp:22 \
  --source-ranges=35.235.240.0/20 --target-tags="$NAME-app"
gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap
```

On the VM:

```bash
sudo journalctl -u google-startup-scripts.service --no-pager
sudo docker ps --filter name=metabase
sudo docker logs --tail 100 metabase
curl -fsS http://127.0.0.1:3000/api/health
```

Exit the SSH session and delete the temporary rule with `gcloud compute firewall-rules delete "$NAME-debug-ssh"`. Review logs privately before sharing; do not print the password or retrieve secret payloads for diagnosis.

For secret fetch failures, inspect configuration without accessing contents:

```bash
gcloud secrets get-iam-policy "$NAME-db-password"
gcloud secrets versions list "$NAME-db-password"
gcloud compute instances describe "$VM" --zone="$ZONE" \
  --format='yaml(serviceAccounts)'
gcloud services list --enabled --filter='name:secretmanager.googleapis.com'
```

Confirm the latest version is enabled, the attached account is `$NAME-vm@$PROJECT_ID.iam.gserviceaccount.com`, it has secret-level `roles/secretmanager.secretAccessor`, and the VM has `cloud-platform` scope. Check NAT, outbound firewall/organization policy, DNS and package/image registry reachability for bootstrap failures. IAM propagation is retried. If the LB remains unhealthy while the local endpoint succeeds, check the VM tag, GFE firewall ranges, named port `http=3000` and backend membership. The application database/user must exist before startup; check DB private reachability and logs for migration errors.

## Updates, rollback and limitations

Changing the image or startup template produces a new instance template. The proactive MIG update replaces the single VM with zero surge and one unavailable instance. **Updates and repairs cause downtime**, but avoid overlapping Metabase instances. To recreate an instance after fixing a bootstrap issue:

```bash
gcloud compute instance-groups managed recreate-instances "$NAME-mig" \
  --instances="$VM" --zone="$ZONE"
```

A reboot retains the existing container configuration. Apply a template update or replace the VM to pick up changed image, environment or credentials. Terraform-managed password rotation must update both SQL and the secret together and be coordinated with VM replacement; existing containers retain the old password. Since the script reads `latest`, publishing a secret version alone does not change the template or automatically roll out the MIG; explicitly recreate the VM after coordinated rotation. Do not rotate only the secret externally.

Back up the application database before upgrading. To roll back, review the previous image/template configuration and Terraform plan; Metabase schema migrations may prevent a simple image downgrade, requiring restoration of the pre-upgrade application DB backup and a compatible image. SQL instance replacement is destructive; inspect plans carefully. Deletion protection defaults to true.

There is no autoscaler. Before extending the MIG with an autoscaler or multiple instances, validate Metabase multi-instance support, edition/licensing, background-job coordination and application DB capacity. This baseline has one VM and zonal SQL, so it is not highly available. Capacity, monitoring/alerting, enforced database TLS and stricter DB role hardening should be evaluated for production. Cloud SQL-created PostgreSQL users have Cloud SQL's default built-in privileges; the dedicated app username is not a custom least-privilege SQL role setup.

## Costs and cleanup

Billable components include the always-on VM and boot disk, Cloud SQL CPU/RAM/storage/backups, global forwarding rules/load balancing and traffic, NAT gateway processing/egress and its external IPs, the LB external IP, Secret Manager storage/access, and DNS hosting if applicable. Cloud SQL disk auto-growth and backup retention can increase costs. Check current regional pricing and configure project budgets before deploying. No fixed monthly estimate is promised.

To delete the assignment later, preserve any required database backup first. Set `database_deletion_protection = false`, review and apply that change, then review `terraform plan -destroy` and run `terraform destroy`. Deleting SQL removes application data; verify backup retention/export separately. Remove the public DNS record, any temporary SSH firewall and any unmanaged backups or state backend resources separately. APIs, project and billing remain enabled. Service Networking may take time to release SQL producer resources; if peering deletion reports resources still in use, wait for SQL deletion to finish and retry destroy. Do not force-delete shared service networking.

## Validation performed

Generated configuration checked with Terraform 1.16.1, Google provider 7.46.1 and Random provider 3.9.1 (recorded in `.terraform.lock.hcl`):

- `terraform fmt -check -recursive`: passed.
- `terraform validate`: passed.
- Startup template rendered with representative non-secret inputs; `bash -n` passed. Mocked Bash checks cover secret retry, failure, password handoff and existing-container reuse.
- Docker Hub confirmed `metabase/metabase:v0.60.27` exists and is active.

Provider initialization and validation required running outside the local sandbox's network/plugin restrictions. No `terraform plan`, `terraform apply` or live cloud deployment was executed. Live API permissions, quota, SQL creation, VM bootstrap and DNS/HTTPS readiness remain deployment-time checks.

## References

- [Official Google Cloud CLI APT installation](https://docs.cloud.google.com/sdk/docs/install-sdk)

- [Cloud SQL editions and supported PostgreSQL versions](https://docs.cloud.google.com/sql/docs/postgres/choose-edition)
- [Cloud SQL instance settings](https://docs.cloud.google.com/sql/docs/postgres/instance-settings)
- [Google load balancer firewall ranges](https://docs.cloud.google.com/load-balancing/docs/firewall-rules)
- [Metabase Docker configuration](https://www.metabase.com/docs/latest/installation-and-operation/running-metabase-on-docker)
- [Pinned Metabase release](https://github.com/metabase/metabase/releases/tag/v0.60.27)

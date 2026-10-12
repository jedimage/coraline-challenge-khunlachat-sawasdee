                    Internet
                       |
                HTTPS Load Balancer
                       |
               Managed Instance Group
                   (min=1)
                       |
                GCE e2-medium
                  2 vCPU / 4GB
                       |
                Docker Metabase
                       |
               Private VPC Network
                       |
              Cloud SQL PostgreSQL 18
                 (Private IP Only)


Supporting Services:
- Instance Template: Startup Script
- Secret Manager: PostgreSQL Credentials
- Service Account: Secret Access
- Terraform: Infrastructure Provisioning

---
Provisioning Order
    |
    +-- Cloud SQL + Database + DB User
    |
    +-- Secret Manager + Password
    |
    +-- Service Account + IAM
    |
    +-- Instance Template
    |
    +-- Managed Instance Group
            |
            v
       Debian 12 Boot
            |
       Install Docker
            |
       Enable Docker
            |
       Retrieve DB Password
            |
       Docker Run Metabase
            |
       LB Health Check
            |
       Ready for HTTPS Traffic
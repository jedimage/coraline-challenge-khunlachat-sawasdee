# coraline-challenge

Technical Assignment สำหรับการสมัครตำแหน่ง DevOps Engineer

By: Khunlachat Sawasdee

# AI Usage

ใช้ Codex เป็น Tools ช่วย Generate Code และ Terraform Configuration และปรับปรุง Implementation บางส่วน โดยแนวทางการออกแบบ การเลือก Technology และการตัดสินใจด้าน Architecture อิงจากความถนัดในการใช้งานจริงเป็นหลัก และให้ความสำคัญกับการทำความเข้าใจและ Review Code ก่อนนำไปใช้งาน

# Assignment 1 — Infrastructure as Code

Directory: assignment1-iac/

ออกแบบ Infra บน Cloud Provider ในที่นี้ใช้ GCP ด้วย Terraform สำหรับ Deploy Metabase บน Docker + PostgreSQL Database

วิธีคิด
- ใช้ Instance Group เพื่อสร้าง Instance ทดแทนเมื่อเกิดปัญหา และรองรับการขยายระบบในอนาคต
- ใช้ Startup Script สำหรับติดตั้ง Docker และ Bootstrap Metabase Container โดยให้ Instance สามารถ Provision ตัวเองใหม่หรือ Scaling ได้
- ใช้ Cloud SQL PostgreSQL ผ่าน Private Network และ Secret Manager สำหรับจัดการ Database Credentials
- ใช้ HTTPS Load Balancer สำหรับรับ Traffic และ Forward ไปที่ Instance Group
- เลือกใช้ GCE แทน Kubernetes เพื่อลดความซับซ้อนในการดูแล Infrastructure สำหรับ Application ขนาดเล็ก
- ใช้ Codex ช่วยสร้าง Terraform และ Startup Script จาก Requirements และ Architecture ตามที่กำหนดไว้

# Assignment 2 — Architecture & CI/CD Design

Directory: assignment2-architecture-and-pipeline-design/

ออกแบบ Application Architecture และ CI/CD Pipeline สำหรับระบบ Frontend, Backend อาจจะมีต่อกับ database และ 3rd party โดยเน้นการ Deploy ที่รวดเร็ว ดูแลรักษาง่าย และเผื่อสำหรับ scaling ในอนาคต

วิธีคิด
- เลือกใช้ Serverless และ Managed Services เพื่อลดภาระการดูแล Infrastructure
- ใช้ Cloudflare Pages สำหรับ Frontend และ Google Cloud Run สำหรับ Backend
- ใช้ Kong API Gateway สำหรับจัดการ API Routing เป็น Public Entrypoint
- ออกแบบให้รองรับการเชื่อมต่อ Database, Third-party Services และ On-premises ในอนาคต
- เลือกใช้ Technology Stack ที่มีประสบการณ์ใช้งานจริง เพื่อให้สามารถ Implement, Troubleshoot และ Maintain ระบบได้อย่างมีประสิทธิภาพ

Architecture ของ Assignment นี้ออกแบบโดยอ้างอิงจากประสบการณ์การทำงานจริง และปรับให้เหมาะสมกับโจทย์โดยเน้นความเรียบง่ายและ Cost-optimization

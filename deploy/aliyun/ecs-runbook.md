# Aliyun ECS Deployment Runbook

This file is prepared for the later ECS deployment step. Do not run Docker locally unless the team explicitly decides to.

## Target Topology

- ECS: runs `web`, `api`, `agent-runtime`, Redis, MinIO, Prometheus and Grafana containers for demo.
- ACR: stores built images.
- RDS MySQL: recommended for production-like demo data.
- OSS: recommended replacement for MinIO when credentials are available.
- Nginx: reverse proxy for `web`, `api` and `agent-runtime`.

## ECS Preparation

1. Create ECS instance with at least 2 vCPU / 4 GB RAM for demo, 4 vCPU / 8 GB RAM preferred.
2. Install Docker Engine and Docker Compose plugin.
3. Open security group ports only as needed:
   - 80 / 443 for web traffic.
   - 22 for SSH from trusted IP.
   - 3001 / 9090 only if Grafana/Prometheus are exposed for demo.
4. Copy `.env.example` to `.env` and replace secrets.

## Build and Push Images

Use ACR after registry credentials are available:

```bash
docker build -f apps/web/Dockerfile -t <acr>/labelhub-web:latest .
docker build -f apps/api/Dockerfile -t <acr>/labelhub-api:latest .
docker build -f apps/agent-runtime/Dockerfile -t <acr>/labelhub-agent-runtime:latest .
docker push <acr>/labelhub-web:latest
docker push <acr>/labelhub-api:latest
docker push <acr>/labelhub-agent-runtime:latest
```

## Deploy

1. Pull images on ECS.
2. Update `deploy/docker-compose.yml` image names or use an ECS-specific override file.
3. Start services with Docker Compose.
4. Verify:
   - `GET /api/tasks/health`
   - `GET /health` on agent runtime
   - web home page loads
   - `/actuator/health`
   - Grafana can reach Prometheus

## Cutover Notes

- Replace MinIO env with OSS credentials before real demo upload/export.
- Replace container MySQL with RDS endpoint for durable data.
- Set `JWT_SECRET`, `LLM_API_KEY` and database passwords through ECS environment variables or a secret manager.

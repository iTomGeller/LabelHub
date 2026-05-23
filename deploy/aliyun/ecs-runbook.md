# 阿里云 ECS 部署运维手册

## 目标拓扑

- ECS: 运行 `web`、`api`、MySQL、Redis、MinIO、Prometheus、Grafana 容器
- ACR: 存储构建镜像（可选）
- RDS MySQL: 生产环境推荐替代容器 MySQL
- Nginx: 反向代理 `web` 和 `api` 服务

## ECS 准备

1. 创建 ECS 实例，推荐 4 vCPU / 8 GB RAM
2. 安装 Docker Engine 和 Docker Compose 插件
3. 安全组仅开放必要端口：
   - 80 / 443：Web 访问
   - 22：SSH（限制来源 IP）
   - 3001 / 9090：仅 Grafana/Prometheus 演示需要时开放
4. 复制 `.env.example` 到 `.env` 并填入密钥

## 构建和推送镜像

```bash
docker build -f apps/web/Dockerfile -t <acr>/labelhub-web:latest .
docker build -f apps/api/Dockerfile -t <acr>/labelhub-api:latest .
docker push <acr>/labelhub-web:latest
docker push <acr>/labelhub-api:latest
```

## 部署

1. 在 ECS 上拉取镜像
2. 更新 `deploy/docker-compose.yml` 中的镜像名或使用 override 文件
3. 使用 Docker Compose 启动服务：
   ```bash
   cd deploy && docker compose -p labelhub up -d
   ```
4. 验证：
   - `GET /api/tasks/health` — API 健康检查
   - `GET /agents/health` — DeepSeek AI 服务状态
   - Web 首页加载正常
   - `/actuator/health` — Spring Boot Actuator
   - Grafana 可连接 Prometheus

## 运维操作

```bash
# 查看容器状态
docker compose -p labelhub ps

# 查看日志
docker compose -p labelhub logs -f api
docker compose -p labelhub logs -f web

# 重新部署（拉取最新代码后）
cd /opt/labelhub-a && git pull
cd deploy && docker compose -p labelhub up -d --build
```

## 注意事项

- 使用 RDS 替代容器 MySQL 以保证数据持久性
- 使用 OSS 替代 MinIO 用于生产文件存储
- 所有密钥（`DEEPSEEK_API_KEY`、数据库密码等）通过环境变量注入，禁止硬编码
- ECS 上的 `.env` 文件由管理员手动维护

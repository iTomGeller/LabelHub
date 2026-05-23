# LabelHub 部署指南

## 1. 环境要求

| 项目 | 最低要求 | 推荐 |
|------|---------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4GB | 16GB |
| 磁盘 | 40GB | 100GB |
| OS | Ubuntu 20.04+ / CentOS 7+ | Ubuntu 22.04 |
| Docker | 24.0+ | 最新版 |
| Docker Compose | v2.20+ | 最新版 |

## 2. 首次部署

### 2.1 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
```

### 2.2 克隆代码

```bash
cd /opt
git clone https://github.com/iTomGeller/LabelHub.git labelhub-a
cd labelhub-a
git checkout feature/member-a-task-config
```

### 2.3 配置环境变量

```bash
cat > deploy/.env << 'EOF'
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
EOF
```

### 2.4 启动服务

```bash
cd deploy
docker compose -p labelhub_a up -d --build
```

### 2.5 配置 Nginx

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /agents/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /swagger-ui {
        proxy_pass http://127.0.0.1:8080;
    }

    location /api-docs {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

## 3. 更新部署

```bash
cd /opt/labelhub-a
git pull origin feature/member-a-task-config
cd deploy
docker compose -p labelhub_a up -d --build
```

或使用部署脚本（需设置环境变量）：

```bash
ECS_PASSWORD=xxx python scripts/redeploy.py
```

## 4. 日志查看

```bash
# 查看所有服务日志
docker compose -p labelhub_a logs -f

# 查看单个服务
docker compose -p labelhub_a logs -f api
docker compose -p labelhub_a logs -f web
```

## 5. 健康检查

```bash
# API 健康
curl http://localhost:8080/api/tasks/health

# DeepSeek 连接状态
curl http://localhost:8080/agents/health

# Web 页面
curl -o /dev/null -w "%{http_code}" http://localhost:3000/
```

## 6. 故障排查

| 现象 | 可能原因 | 解决方案 |
|------|---------|---------|
| API 启动失败 | MySQL 未就绪 | 等待 healthcheck 通过 |
| DeepSeek 返回兜底配置 | API Key 未配置 | 检查 deploy/.env |
| Web 502 | API 未启动 | 检查 api 容器日志 |
| 构建超时 | 网络问题 | 配置 Docker 镜像加速 |

## 7. Docker 镜像加速（国内）

```bash
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://registry.docker-cn.com"
  ]
}
EOF
systemctl restart docker
```

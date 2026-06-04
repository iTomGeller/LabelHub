# LabelHub 快速启动指南

## 第一步：启动基础服务
确保你已经安装了 Docker Desktop，然后在 PowerShell 里进入 deploy 目录执行：

```powershell
cd d:\LabelHub\LabelHub-A\deploy
docker-compose up -d
```

## 第二步：验证 Docker 服务是否启动成功

### 方法1：用 docker ps 查看运行中的容器
在终端输入：
```powershell
docker ps
```

✅ 正常结果应该看到 3 个容器状态都是 `Up (healthy)`：
```
CONTAINER ID   STATUS                    NAMES
xxxxxxxxxxx    Up 10 seconds (healthy)  labelhub-mysql
xxxxxxxxxxx    Up 5 seconds (healthy)   labelhub-redis
xxxxxxxxxxx    Up 3 seconds (healthy)   labelhub-minio
```

### 方法2：逐个验证每个服务

#### 验证 MySQL
- 用你的数据库工具（Navicat、DBeaver、DataGrip）连接
  - Host: `localhost`
  - Port: `3307`
  - User: `labelhub`
  - Password: `labelhub`
  - Database: `labelhub`
- 能正常连上，能看到空的 labelhub 数据库就成功了

#### 验证 Redis
打开终端运行：
```powershell
docker exec -it labelhub-redis redis-cli ping
```
✅ 返回 `PONG` 就成功了

#### 验证 MinIO
浏览器打开：http://localhost:9001
- 用户名：`minioadmin`
- 密码：`minioadmin`
- 能正常登录看到 MinIO 控制台就成功了

## 第三步：在 IDEA 中启动 Spring Boot 后端
回到 IDEA，直接运行 `LabelHubApiApplication.java`

启动过程中你会在控制台看到 Flyway 自动执行迁移：
```
Flyway: Migrating schema `labelhub` to version 1 - member a task config
Flyway: Migrating schema `labelhub` to version 2 - agent trace knowledge
Flyway: Migrating schema `labelhub` to version 3 - trace completeness
Flyway: Migrating schema `labelhub` to version 4 - repair business details
Flyway: Migrating schema `labelhub` to version 5 - member b annotation workflow complete
Started LabelHubApiApplication in X.XXX seconds
```

✅ 启动完成后，访问 http://localhost:8080/swagger-ui.html 能看到所有API文档

## 第四步：去数据库查看所有自动创建的表
连上 MySQL localhost:3307，你会看到 Flyway 自动创建了全部表：
- A 模块表：task, schema, dataset, knowledge_base, agent_trace...
- B 模块表：annotation_item, assignments, workflow_events, agent_run, review...

## 停止服务
```powershell
docker-compose down
```

保留数据卷（推荐，下次启动数据还在），想完全清除所有数据：
```powershell
docker-compose down -v
```

# LabelHub — AI 数据标注生产平台

LabelHub 是一个 AI 驱动的数据标注任务管理平台，支持从任务配置、标注执行到质量审核的全流程。

## 项目架构

```
LabelHub/
├── apps/
│   ├── api/          # Java 21 + Spring Boot 3 后端（含 DeepSeek AI 集成）
│   └── web/          # Next.js 14 前端
├── packages/
│   └── contracts/    # TypeScript 共享类型定义
├── deploy/           # Docker Compose 部署配置
├── docs/             # 接口文档、契约文档
└── scripts/          # 部署脚本
```

## 模块分工

| 模块 | 角色 | 职责 |
|------|------|------|
| A（任务配置） | 当前模块 | 任务创建、Schema 设计、Rubric 规则、数据导入、AI 自动配置 |
| B（标注工作台） | 协作方 | 标注员领取任务、执行标注、提交结果 |
| C（审核工作台） | 协作方 | 审核员质检、打分、退回重标 |

## 技术栈

- **后端**: Java 21, Spring Boot 3.3, MySQL 8, Redis 7, Flyway
- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI**: DeepSeek Chat API（通过 Spring WebClient 调用）
- **部署**: Docker Compose, 阿里云 ECS, Nginx 反向代理
- **监控**: Prometheus + Grafana

## 快速开始

### 环境要求

- Java 21+
- Node.js 22+
- Docker & Docker Compose
- MySQL 8.x

### 本地开发

```bash
# 1. 安装前端依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 3. 启动基础设施
cd deploy && docker compose up -d mysql redis

# 4. 启动后端
cd apps/api && ./mvnw spring-boot:run

# 5. 启动前端
npm run dev -w @labelhub/web
```

### Docker 部署（生产环境）

```bash
# 创建 .env 文件
echo "DEEPSEEK_API_KEY=your-key-here" > deploy/.env

# 一键启动所有服务
cd deploy && docker compose -p labelhub up -d --build
```

## 核心功能（A 模块）

### 1. 任务创建工作流（4 步）

1. **上传数据** — 导入 JSON/JSONL 样例数据，填写任务名称和说明
2. **配置模板** — AI 自动生成或手动编辑标注组件（10 种组件类型）
3. **质检规则** — AI 生成 Rubric 规则，支持手动调整严重度和正反例
4. **确认发布** — 检查完整性，发布后 B/C 模块可消费

### 2. AI 一键配置

基于 DeepSeek Chat API，输入任务描述 + 样例数据，自动生成：
- 标注模板组件（SchemaComponents）
- 质检规则（RubricRules）
- 评分维度（Dimensions）
- 分配策略和 Agent 策略

### 3. B/C 消费接口

| 接口 | 说明 | 消费方 |
|------|------|--------|
| `GET /api/tasks/{id}/package` | 获取完整任务包 | B + C |
| `GET /api/tasks/{id}/schema/current` | 获取当前 Schema | B |
| `GET /api/tasks/{id}/instructions` | 获取标注说明 | B |
| `GET /api/tasks/{id}/items/next` | 获取下一条待标注数据 | B |

## API 文档

启动后端后访问 Swagger UI：

```
http://localhost:8080/swagger-ui.html
```

## 部署信息

- **ECS 地址**: 通过 Nginx 反向代理，80 端口对外
- **服务端口**:
  - Web: 3000（内部）
  - API: 8080（内部）
  - MySQL: 3306
  - Redis: 6379

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 无（必填） |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` |
| `SPRING_DATASOURCE_URL` | MySQL 连接地址 | `jdbc:mysql://mysql:3306/labelhub` |
| `LABELHUB_API_PORT` | API 服务端口 | `8080` |

## 文档目录

| 文档 | 路径 | 说明 |
|------|------|------|
| 架构设计 | `docs/architecture.md` | 系统架构、模块关系、数据流 |
| 开发过程 | `docs/development-process.md` | 5 个 Sprint 迭代记录 |
| AI Coding 过程 | `docs/ai-coding-process.md` | Cursor Agent 辅助开发全流程记录 |
| 部署指南 | `docs/deployment-guide.md` | ECS 部署、Nginx 配置、故障排查 |
| API 文档 | `docs/api/member-a-api.md` | A 模块所有 REST 接口详细说明 |
| Schema 契约 | `docs/contracts/schema-contract.md` | A↔B 标注模板数据格式 |
| Rubric 契约 | `docs/contracts/rubric-contract.md` | A↔C 质检规则数据格式 |
| Prompt 契约 | `docs/contracts/prompt-template-contract.md` | AI 生成模板 |

## 演示环境

- **访问地址**: `http://8.146.231.216`（阿里云 ECS，Nginx 反向代理）
- **功能演示**: 4 步任务创建 → AI 一键配置 → 发布任务包
- **API 测试**: `http://8.146.231.216/swagger-ui.html`

## 开发规范

- 代码提交使用 Conventional Commits 格式
- 后端统一使用 Java，禁止引入 Python 运行时
- 前端使用 TypeScript 严格模式
- API 设计遵循 RESTful 规范
- 敏感信息（API Key 等）禁止提交到代码仓库，使用环境变量注入

## 交付物清单

- [x] 源码仓库（GitHub）
- [x] 中文 README
- [x] 架构图 / 技术文档
- [x] AI Coding 过程记录
- [x] 可访问演示环境
- [x] API 文档（Swagger + Markdown）
- [ ] 5-10 分钟演示视频（待录制）

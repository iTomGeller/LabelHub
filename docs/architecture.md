# LabelHub 系统架构文档

## 1. 系统概述

LabelHub 是面向 AI 数据标注场景的生产平台，采用 ABC 三角色协作模式：
- **A（任务配置）**: 负责标注任务的创建、Schema 设计、Rubric 规则、数据导入
- **B（标注工作台）**: 标注员领取并执行标注
- **C（审核工作台）**: 审核员质检、打分、退回

## 2. 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Nginx (80)                            │
├─────────────────────────────────────────────────────────────┤
│   /            →  Web (Next.js :3000)                       │
│   /api/        →  API (Spring Boot :8080)                   │
│   /agents/     →  API (Spring Boot :8080)                   │
└─────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────┐    ┌──────────────────────┐
│   Next.js    │    │    Spring Boot API    │
│   (SSR/CSR)  │    │  ┌────────────────┐  │
│              │    │  │ TaskConfig      │  │
│  TaskStepper │───▶│  │ AiGenerate     │  │
│  AiDrawer    │    │  │ Dataset        │  │
│  TaskList    │    │  │ DeepSeekService │──┼──▶ DeepSeek API
│              │    │  └────────────────┘  │
└──────────────┘    └──────────┬───────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌─────────┐ ┌───────┐ ┌─────────┐
              │ MySQL   │ │ Redis │ │ MinIO   │
              │ (数据)  │ │(缓存) │ │(文件)   │
              └─────────┘ └───────┘ └─────────┘
```

## 3. 模块职责

### 3.1 后端 API (apps/api)

| 包路径 | 职责 |
|--------|------|
| `controller/TaskConfigController` | 任务配置 CRUD、发布检查 |
| `controller/AiGenerateController` | AI 一键生成接口 |
| `controller/DatasetController` | 数据集导入预览 |
| `service/DeepSeekService` | DeepSeek Chat API 集成 |
| `service/TaskPackageService` | 任务包组装、发布就绪检查 |
| `service/SchemaValidator` | Schema 校验逻辑 |
| `dto/` | 数据传输对象定义 |
| `model/` | 枚举和领域模型 |

### 3.2 前端 Web (apps/web)

| 组件 | 职责 |
|------|------|
| `TaskStepper` | 4 步线性任务创建流程 |
| `TaskList` | 任务列表管理 |
| `AiDrawer` | 浮动 AI 助手面板 |
| `SettingsView` | 系统配置 |
| `AppShell` | 全局布局和导航 |

## 4. 数据流

### 4.1 AI 一键配置流程

```
用户输入任务描述 + 样例数据
        │
        ▼
前端 POST /agents/generate-task-config
        │
        ▼
Java DeepSeekService → DeepSeek Chat API
        │
        ▼
返回 SchemaComponents + RubricRules + Policies
        │
        ▼
前端渲染可编辑表单 → 用户微调 → 确认发布
```

### 4.2 B/C 消费流程

```
A 发布任务
    │
    ▼
B 调用 GET /api/tasks/{id}/package → 获取 Schema + Instructions
    │
    ▼
B 渲染标注界面 → 标注员执行标注
    │
    ▼
C 调用 GET /api/tasks/{id}/package → 获取 Rubric + Dimensions
    │
    ▼
C 审核界面 → 审核员质检打分
```

## 5. 部署架构

### 5.1 Docker Compose 服务编排

| 服务 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| web | 自构建 | 3000 | Next.js 前端 |
| api | 自构建 | 8080 | Spring Boot 后端 |
| mysql | mysql:8.4 | 3306 | 关系数据库 |
| redis | redis:7-alpine | 6379 | 缓存 |
| minio | minio/minio | 9000/9001 | 对象存储 |
| prometheus | prom/prometheus | 9090 | 监控采集 |
| grafana | grafana/grafana | 3001 | 监控面板 |

### 5.2 ECS 部署

- 阿里云 ECS 4C16G
- Nginx 反向代理统一入口（80 端口）
- Docker Compose 管理所有服务
- 敏感配置通过环境变量注入（不入库）

## 6. 安全设计

- API Key 通过环境变量注入，禁止硬编码
- Docker Compose 使用 `${DEEPSEEK_API_KEY}` 引用宿主机环境变量
- `.env` 文件已加入 `.gitignore`
- 接口鉴权预留 JWT 方案（当前开发阶段暂未启用）

## 7. 多 Agent DAG 架构

A 模块在任务发布前使用 7-stage 多 Agent 流水线进行智能审核：

```
TaskContextBuilder → SkillLoader → DatasetSampler → SchemaGenerator → RubricGenerator → Critic → TaskPackageWriter
```

**设计要点**:
- 每个 Agent 独立职责，通过 `AgentPipelineService` 串行编排
- SkillLoader 从 `skills/` 目录加载 Markdown 技能文件，注入为 RAG 上下文
- SchemaGenerator 和 DatasetSampler 调用 DeepSeek Chat API
- Critic 综合评审所有产出，输出置信度和问题列表
- 每个 stage 记录 Micrometer metrics（调用次数、延迟、成功率）
- 前端展示自然语言摘要，技术详情可选查看
- DAG 结果作为发布卡点：不通过则禁止发布

详见: [多 Agent Pipeline 设计文档](multi-agent-pipeline.md)

## 8. 扩展性设计

- DeepSeek 调用通过 `DeepSeekService` 封装，可替换为其他 LLM
- Schema 组件类型通过枚举扩展
- B/C 模块通过标准 REST 接口对接，无代码耦合
- 任务状态机支持 draft → publishing → paused → ended 全生命周期
- Pipeline 新增 Agent 只需在 `executePipeline()` 中添加 stage，前端自动渲染
- SkillLoader 预留 MCP/外部 RAG 扩展点

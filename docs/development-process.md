# LabelHub A 模块开发过程文档

## 1. 项目背景

LabelHub 是 ABC 三人协作的 AI 数据标注平台。本文档记录 A 模块（任务配置）的完整开发过程。

## 2. 需求分析

### 2.1 核心需求

- 任务创建全流程：数据导入 → 模板配置 → 质检规则 → 发布
- AI 辅助配置：接入 DeepSeek API，根据任务描述和样例自动生成配置
- B/C 消费接口：提供标准 REST API 供标注和审核模块调用

### 2.2 非功能需求

- 全中文界面
- 操作简洁，4 步完成任务创建
- 支持 Docker 一键部署
- 全 Java 后端（禁止 Python 运行时）

## 3. 技术选型决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 后端语言 | Java 21 | 团队统一要求 |
| 后端框架 | Spring Boot 3.3 | 成熟稳定、生态丰富 |
| HTTP Client | Spring WebClient | 非阻塞、支持响应式 |
| 前端框架 | Next.js 14 | SSR 支持、文件路由 |
| AI 接入 | DeepSeek Chat API | OpenAI 兼容协议、性价比高 |
| 数据库 | MySQL 8 | 团队熟悉、Docker 支持好 |
| 部署方式 | Docker Compose | 本地和 ECS 统一 |

## 4. 迭代过程

### Sprint 1: 基础骨架

- 搭建 monorepo 结构（apps/api, apps/web, packages/contracts）
- Spring Boot 后端初始化 + Flyway 数据库迁移
- Next.js 前端初始化 + Tailwind CSS
- TypeScript 共享契约定义
- Docker Compose + Dockerfile 编写

### Sprint 2: A 模块核心实现

- TaskPackageService 实现任务包组装逻辑
- SchemaValidator 实现 10 种组件类型校验
- TaskConfigController 实现所有 REST 端点
- 前端 TaskWizard 实现初版（后优化为 TaskStepper）
- 前端 SchemaBuilder + DatasetImport 组件

### Sprint 3: UX 优化

- 用户反馈：界面过于复杂、不够简洁
- 重构为 4 步线性流程（TaskStepper）
- 导航从 7 项精简为 3 项
- 引入浮动 AI 助手（AiDrawer）
- 全界面中文化

### Sprint 4: AI 真实接入

- 接入 DeepSeek Chat API（Java WebClient）
- 实现 `/agents/generate-task-config` 端点
- 前端 "AI 一键配置" 按钮调用真实 API
- 表单全部可编辑（非只读展示）
- 带兜底逻辑：API 不可达时返回默认配置

### Sprint 5: 部署验证

- ECS 部署（Docker Compose）
- Nginx 反向代理配置
- 端到端验证：前端 → Java API → DeepSeek → 返回结果
- API Key 安全处理（环境变量注入，不入库）

## 5. 关键设计决策

### 5.1 为什么不用独立的 Agent 服务？

初期曾用 Python FastAPI 实现独立 Agent Runtime，后因团队要求"全 Java 后端"而合并到 Spring Boot API 中。合并后：
- 减少一个容器，降低运维复杂度
- 共享 Spring 生态（依赖注入、配置管理、日志）
- 前端只需对接一个后端地址

### 5.2 AI 生成的兜底策略

DeepSeek API 可能因网络、限流等原因不可用，因此 `DeepSeekService` 内置本地兜底配置：
- 3 个基础组件（展示项 + 单选 + 文本）
- 2 条通用规则
- 4 个默认评分维度

### 5.3 B/C 解耦设计

A 发布后产出标准 TaskPackage JSON，B/C 通过 `GET /api/tasks/{id}/package` 获取，无代码级依赖。合约通过 `packages/contracts` 共享 TypeScript 类型定义。

## 6. 遇到的问题与解决

| 问题 | 根因 | 解决方案 |
|------|------|---------|
| ECS Docker 构建超时 | Docker Hub 国内访问慢 | 配置腾讯云镜像加速 |
| Nginx 代理 404 | proxy_pass 路径不匹配 | 移除末尾斜杠 |
| API Key 泄露到 Git | 硬编码在 docker-compose | 改为 ${ENV_VAR} 引用 |
| Next.js 代理到后端 | CORS 问题 | 使用 Next.js rewrites |
| 用户觉得 UI 复杂 | 一次展示太多信息 | 重构为 4 步线性流程 |

## 7. 测试策略

- **单元测试**: SchemaValidator、TaskPackageService（JUnit 5）
- **集成测试**: DeepSeek API 调用（需真实 Key）
- **端到端验证**: curl 验证所有接口返回正确
- **前端验证**: TypeScript 严格模式编译通过

## 8. 后续规划

- [ ] 任务数据持久化（MySQL）
- [ ] 文件上传到 MinIO
- [ ] JWT 鉴权
- [ ] WebSocket 实时通知
- [ ] 任务状态机完善

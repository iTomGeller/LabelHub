# AI Coding 过程记录

## 1. 工具选择

| 工具 | 用途 | 版本 |
|------|------|------|
| Cursor IDE | AI 辅助编码主力工具 | Latest (2026) |
| Cursor Agent | 多轮对话式 AI 编程 | Claude Opus 4.6 |
| DeepSeek Chat API | 项目内 AI 功能接入 | deepseek-chat |

## 2. 开发模式

采用 **AI-Human Collaborative Development** 模式：
- 人类提出需求、审核结果、提供反馈
- AI Agent 执行代码生成、重构、调试、部署
- 通过多轮对话迭代优化

## 3. AI Coding 全流程记录

### 3.1 项目初始化阶段

**人类输入**: 提供飞书课题计划文档 + GitHub 仓库地址 + 角色分工说明

**AI 执行**:
1. 分析计划文档，理解 A 模块职责范围
2. 创建 `feature/member-a-task-config` 分支
3. 搭建 monorepo 目录结构（apps/api, apps/web, packages/contracts）
4. 初始化 Spring Boot 后端骨架（Java 21 + Spring Boot 3.3）
5. 初始化 Next.js 前端骨架（Next.js 14 + Tailwind CSS）
6. 编写 TypeScript 共享契约（packages/contracts）
7. 编写 Dockerfile 和 docker-compose.yml

**产出**: 完整的项目骨架，可直接构建运行

### 3.2 核心功能实现阶段

**人类输入**: 基于计划文档中的接口要求和功能描述

**AI 执行**:
1. 实现 `TaskConfigController` — 任务配置 CRUD 接口
2. 实现 `TaskPackageService` — 任务包组装逻辑
3. 实现 `SchemaValidator` — 10 种组件类型校验
4. 编写 `SchemaValidatorTest` 单元测试
5. 实现前端 `TaskWizard` 组件
6. 实现前端 `SchemaBuilder`、`DatasetImport` 组件
7. 编写数据库迁移脚本 `V1__member_a_task_config.sql`

**关键决策**:
- 使用 Flyway 管理数据库版本
- B/C 消费接口设计为 RESTful JSON 格式
- 前端通过 Next.js rewrites 代理后端 API

### 3.3 UX 迭代优化阶段

**人类反馈**:
- "UI 用户交互很垃圾"
- "所有都赶着投胎一样全部展示给我很累看着"
- "操作很繁琐...太太太复杂了"
- "多一些子 tab 而不是所有都展示"

**AI 响应**（3 轮迭代）:

**第 1 轮**: 中文化全部导航和标签
- 侧边栏菜单改为中文
- 所有组件内文案中文化

**第 2 轮**: 增加子 Tab 和筛选
- 每个工作区增加子 Tab 分类
- 添加搜索和状态筛选

**第 3 轮**: 彻底重构为线性流程
- 将复杂的 TaskWizard 重构为 4 步线性 TaskStepper
- 导航从 7 项精简为 3 项
- 引入浮动 AI 助手 Drawer
- 采用渐进式披露设计（Progressive Disclosure）

**关键学习**: 用户不需要看到所有功能，只需要被引导完成核心任务流

### 3.4 AI 真实接入阶段

**人类输入**: 提供 DeepSeek API Key，要求"真正接入看效果"

**AI 执行**:
1. 实现 `DeepSeekService.java` — Spring WebClient 调用 DeepSeek
2. 实现 `AiGenerateController.java` — REST 端点暴露 AI 生成能力
3. 前端 TaskStepper "AI 一键配置" 按钮连接真实 API
4. 实现兜底逻辑（API 不可用时返回默认配置）
5. 实现 `/agents/health` 健康检查端点

**架构决策**:
- 初期曾用 Python FastAPI 实现独立 Agent Runtime
- 收到"后端全部 Java"反馈后，立即迁移到 Spring Boot 内
- 使用 Spring WebClient（非阻塞）替代同步 HTTP 调用

### 3.5 部署验证阶段

**人类输入**: 提供 ECS 服务器信息，要求部署验证

**AI 执行**:
1. 编写 ECS 部署脚本（Python paramiko SSH）
2. 配置 Docker 镜像加速（国内网络优化）
3. 构建并启动所有容器
4. 配置 Nginx 反向代理
5. 端到端验证所有接口

**遇到的问题**:
| 问题 | AI 解决方案 |
|------|-----------|
| Docker Hub 超时 | 配置腾讯云镜像加速 |
| Nginx 代理 404 | 修正 proxy_pass 路径 |
| 端口已占用 | 停止旧容器后重启 |
| 构建输出编码错误 | 设置 `COMPOSE_ANSI=never` |

### 3.6 安全修复阶段

**人类反馈**: "labelhub 的 github 泄露了我的 deepseek apikey"

**AI 执行**:
1. 审计所有文件，定位硬编码凭证
2. 重构脚本改为环境变量读取
3. 使用 `git filter-branch` 重写历史移除密码
4. Force push 清洁历史到 GitHub
5. 建议用户轮换 API Key

## 4. AI 辅助效率统计

| 阶段 | 预估人工耗时 | AI 辅助耗时 | 提效比 |
|------|------------|-----------|--------|
| 项目初始化 | 8h | 30min | 16x |
| 核心功能 | 24h | 3h | 8x |
| UX 迭代（3轮） | 12h | 2h | 6x |
| AI 接入 | 8h | 1h | 8x |
| 部署验证 | 4h | 1.5h | 2.7x |
| 安全修复 | 2h | 30min | 4x |
| **合计** | **58h** | **8.5h** | **~7x** |

## 5. AI Coding 最佳实践总结

### 5.1 有效的人类输入模式

- **明确的角色和边界**: "我负责 A 模块"让 AI 聚焦范围
- **具体的 UX 反馈**: "太复杂了"不如"4步完成"具体
- **提供样例数据**: API Key、服务器信息等让 AI 直接执行
- **及时纠偏**: "后端全部 Java"避免方向偏差

### 5.2 AI 的优势场景

- 重复性代码生成（CRUD、DTO、Controller）
- 跨文件重构（Python → Java 迁移）
- 配置文件编写（Docker、Nginx、Maven）
- 问题诊断和修复（日志分析、端口冲突）
- 文档生成（README、API 文档、部署指南）

### 5.3 需要人类判断的场景

- UX 设计决策（什么信息对用户重要）
- 安全敏感操作（API Key 管理策略）
- 架构取舍（独立服务 vs 单体）
- 业务需求优先级

## 6. Cursor Agent 使用技巧

1. **提供上下文文件**: 直接引用飞书文档、GitHub 链接
2. **分步推进**: 先搭骨架 → 实现功能 → 优化 UX → 部署
3. **即时反馈**: 每步验证后再进下一步
4. **利用 /pua**: 激励 AI 穷尽方案不轻易放弃
5. **多轮迭代**: 通过反馈不断逼近理想效果

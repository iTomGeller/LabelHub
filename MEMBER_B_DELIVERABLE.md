# 成员 B 交付物：标注生产流转闭环

## 闭环概述
成员 B 完整实现了标注分发、人工审核、状态机流转、事件日志和生产流转类 Agent 的全链路闭环。

## 核心交付物清单

### 1. 统一契约定义 ([workflow-states.ts](file:///d:/LabelHub/packages/contracts/workflow-states.ts))
- 10 种标注条目状态枚举 (CREATED → ARCHIVED)
- 9 种工作流事件类型枚举
- 完整的 WorkflowEvent、AnnotationItem、TaskAssignment 接口定义

### 2. Java Spring Boot 后端工程
- [pom.xml](file:///d:/LabelHub/apps/api/pom.xml): 项目依赖配置
- **实体层**: AnnotationItem、WorkflowEventLog 带完整 JPA 映射
- **状态引擎**: [WorkflowStateMachine.java](file:///d:/LabelHub/apps/api/src/main/java/com/labelhub/service/WorkflowStateMachine.java) - 严格校验状态转移合法性
- **分发服务**: [AnnotationDistributionService.java](file:///d:/LabelHub/apps/api/src/main/java/com/labelhub/service/AnnotationDistributionService.java)
  - 任务领取（先到先得 + 配额控制）
  - 草稿自动保存
  - 标注提交触发 AI 预审入队
- **审核服务**: [ReviewWorkbenchService.java](file:///d:/LabelHub/apps/api/src/main/java/com/labelhub/service/ReviewWorkbenchService.java)
  - 四栏审核工作台操作
  - 单条/批量通过
  - 带理由打回（自动流转回标注环节）
  - 完整审计日志追溯
- **REST API**: AnnotationController 暴露所有端点

### 3. 前端页面（严格遵循 LabelHub Design Tokens）
- AppShell 全局布局组件（左导航+顶栏+主工作区+AgentPanel 右侧面板）
- [标注工作台](file:///d:/LabelHub/apps/web/src/app/annotation/workbench/page.tsx) - 任务领取、自动草稿保存、提交
- [人工审核工作台](file:///d:/LabelHub/apps/web/src/app/review/workbench/page.tsx) - 待审核列表、原始数据、标注结果+AI意见、审核动作 四栏布局

### 4. 状态流转覆盖
完整实现飞书要求的流转：标注员领取 → 草稿保存 → 提交 → AI预审 → 人工审核 → 打回重标 → 审核通过 → 归档

## 集成契约
- 消费成员 A 输出的 TaskPackage，产出标注事件流
- 输出事件给成员 C 触发 LangGraph Agent 质检和后续批处理

# 多 Agent DAG Pipeline 设计文档

## 1. 概述

LabelHub A 模块采用 7-stage 多 Agent 流水线（DAG）架构，在任务发布前对配置进行全方位智能审核。每个 Agent 独立执行特定职责，通过有向无环图（DAG）串联，确保任务配置的完整性和质量。

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    AgentPipelineService                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [1] TaskContextBuilder                                          │
│       │  组装: taskName + instruction + sampleData               │
│       ▼                                                           │
│  [2] SkillLoader                                                 │
│       │  加载: skills/ 目录下 .md 文件 → RAG 上下文              │
│       ▼                                                           │
│  [3] DatasetSampler                                              │
│       │  生成/验证样例数据                                        │
│       ▼                                                           │
│  [4] SchemaGenerator                                             │
│       │  调用 DeepSeek → 生成 SchemaComponents                   │
│       ▼                                                           │
│  [5] RubricGenerator                                             │
│       │  从 config 提取 rubricRules + rubricDimensions           │
│       ▼                                                           │
│  [6] Critic                                                       │
│       │  校验完整性 → 输出 issues + confidence                   │
│       ▼                                                           │
│  [7] TaskPackageWriter                                           │
│       └─ 组装最终 TaskPackage                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 各 Agent 职责详述

### 3.1 TaskContextBuilder

**职责**: 将原始输入（任务名称、任务说明、样例数据）组装为结构化上下文。

**输出字段**:
- `taskName`: 任务名称
- `instructionPreview`: 说明前80字
- `sampleDataCount`: 样例数量
- `hasInstruction`: 是否有说明
- `hasSampleData`: 是否有样例

**自然语言摘要**: "任务「电商评论情感分析」上下文已组装：含任务说明，样例数据 6 条"

### 3.2 SkillLoader

**职责**: 从 `skills/` 目录加载专业技能文件，提取 Rules/Checks 段落作为 RAG 上下文注入后续 Agent 的 prompt。

**加载的技能**:
- `task-schema-builder.md` — Schema 生成规则
- `instruction-refine.md` — 指令优化检查项
- `dataset-profile.md` — 数据质量分析要求
- `design-enterprise.md` — UI/UX 设计规范

**输出**: 技能列表 + RAG 上下文长度

### 3.3 DatasetSampler

**职责**: 验证用户提供的样例数据，或调用 DeepSeek 生成新样例。

**逻辑**:
- 如果 `sampleData` 非空 → 验证字段结构
- 如果 `sampleData` 为空 → 调用 `DeepSeekService.generateSampleData()` 生成 6 条

**输出**: 样例数量、字段列表、数据来源（AI 生成/用户提供）

### 3.4 SchemaGenerator

**职责**: 调用 DeepSeek Chat API，根据任务上下文和样例数据生成标注模板组件。

**Prompt 策略**:
- System Prompt: LabelHub 标注配置 AI 助手角色定义 + 组件类型约束 + 输出格式要求
- User Prompt: 任务名称 + 说明 + 前3条样例数据
- Temperature: 0.3（低随机性，保证结构一致性）
- Response Format: `json_object`

**输出**: 组件列表（id/type/label）+ rationale 节选

### 3.5 RubricGenerator

**职责**: 从 SchemaGenerator 的结果中提取质检规则和评分维度。

**输出**:
- 规则数量和详情（ruleId/description/severity）
- 维度列表
- 严重度分布统计（critical/high/medium/low 各多少条）

### 3.6 Critic

**职责**: 对前面所有 Agent 的产出进行综合评审，判断任务配置是否就绪。

**检查项**:
- 模板完整性（是否有 SchemaComponents）
- 规则覆盖度（是否有 RubricRules）
- 数据充分性（样例是否 >= 3 条）
- 维度合理性（是否有评分维度）

**输出**: issues 列表 + suggestions + confidence score (0-1)

### 3.7 TaskPackageWriter

**职责**: 将所有 Agent 产出组装为最终的 TaskPackage 结构。

**输出**: 完整 TaskPackage JSON + 就绪状态

## 4. 技术实现

### 4.1 核心类

```
AgentPipelineService.java
├── executePipeline(PipelineRequest) → PipelineResponse
├── loadSkills() → List<Map<String, String>>
├── extractYamlField(content, field) → String
└── extractSection(content, start, end) → String
```

### 4.2 数据结构

```java
record PipelineResponse(
    String pipelineId,
    List<StageResult> stages,
    boolean allPassed,
    Map<String, Object> taskPackage,
    PipelineLog pipelineLog
)

record StageResult(
    String stage,
    String status,      // "success" | "warning" | "error"
    long durationMs,
    Map<String, Object> output,
    String summary      // 自然语言摘要（面向任务创建者）
)

record PipelineLog(
    String promptSnapshot,
    int tokensUsed,
    List<String> skillsLoaded,
    String modelUsed,
    String ragContext
)
```

### 4.3 监控指标

每个 Stage 自动记录:
- `agent.invocations{agent=X, outcome=Y}` — 调用计数
- `agent.latency{agent=X}` — 延迟分布
- `agent.chain{from=X, to=Y}` — 调用链追踪
- `task.pipeline.duration{stage=X}` — 阶段耗时

### 4.4 Skill 加载机制

Pipeline 启动时读取 `skills/` 目录下的 Markdown 文件：
1. 解析 YAML Front Matter 获取 name/description
2. 提取 `## Rules` 或 `## Checks` 段落
3. 将内容注入为 RAG 上下文，增强后续 Agent 的 prompt 质量

## 5. 前端集成

### 5.1 发布页 AI 智能审核

- 进入 Step 4（确认发布）时自动触发 pipeline
- 展示 7 个审核维度的通过/警告状态
- 每个维度可展开查看自然语言详情
- DAG 结果作为发布卡点：未通过则禁止发布

### 5.2 面向任务创建者的展示

技术指标（pipelineId、durationMs）默认隐藏，通过"查看技术详情"按钮可选展示。主界面只展示：
- 审核维度名称（业务语言）
- 通过/警告状态
- 自然语言摘要（`summary` 字段）

## 6. 扩展性

### 6.1 新增 Agent

在 `executePipeline()` 中新增一个 stage 即可，无需修改前端（前端动态渲染 stages 数组）。

### 6.2 外部 MCP/Tool 调用

SkillLoader 已预留扩展点，未来可接入：
- MCP Server 调用（通过 Spring WebClient）
- 外部知识库 RAG 检索
- 自定义验证规则引擎

### 6.3 并行执行

当前为串行 DAG。若需并行（如 SchemaGenerator 和 RubricGenerator 并发），可改用 `CompletableFuture` 编排。

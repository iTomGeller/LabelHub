# LabelHub Agent Runtime (Member B)

这是成员B负责的agent-runtime，基于LangGraph实现生产协同类Agent。

## 负责范围

成员B的Agent只做生产协同和人工审核辅助：
- 可以建议分配策略、总结风险、解释冲突、提示 SLA 风险
- 不直接决定最终通过或退回
- 不直接改写任务 Schema 和 Rubric
- 输出必须进入审核台、调度建议或 WorkflowEvent

## MCP B 工具列表

- `annotation.getSubmitted` - 获取已提交的标注条目
- `annotation.lookupSimilar` - 检索相似历史标注
- `review.getHistory` - 获取审核历史记录
- `workflow.getAuditTrail` - 获取工作流审计轨迹
- `assignment.getLoad` - 获取人员负载和分配建议
- `agent.getRun` - 查询Agent运行记录

## 核心Agent

1. AssignmentAgent - 任务分发和人员负载建议
2. ReviewAssistAgent - 人工审核辅助
3. ConflictResolveAgent - 冲突解释和解决建议
4. SlaAgent - SLA 风险提示
5. ReviewerCoachAgent - 审核员辅助指导

## 目录结构

```
agent-runtime/
├── agent_runtime/
│   ├── __init__.py
│   ├── main.py
│   ├── mcp/              # MCP工具客户端
│   ├── agents/           # LangGraph Agent定义
│   ├── skills/           # 可版本化Skill定义
│   ├── observability/    # 可观测性追踪
│   └── schemas/          # Pydantic数据模型
└── skills/               # 外部Skill文件目录
```

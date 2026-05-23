# Rubric Contract

`RubricVersion` 是 A 输出给 C 预审 Agent 的主要判断依据，也是 B 审核台展示规则摘要的来源。

## Fields

- `rubricVersionId`: 版本 ID。
- `taskId`: 所属任务。
- `version`: 单调递增版本号。
- `dimensions`: 评分维度。
- `promptTemplate`: 预审 Prompt 模板。
- `rules`: 结构化规则列表。
- `frozen`: 发布后不可变。

## Rule Fields

- `ruleId`: 规则 ID，必须稳定。
- `description`: 可读规则描述。
- `severity`: `low | medium | high | critical`。
- `appliesTo`: 适用的 Schema 组件 ID。
- `positiveExamples`: 正例。
- `negativeExamples`: 反例。
- `allowAgentAutoPass`: 是否允许 Agent 高置信自动通过到抽检池。

## Boundary

Rubric 只能影响 AI 建议和人工审核参考，不允许直接改变 B 的工作流状态。

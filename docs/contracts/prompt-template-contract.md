# Prompt Template Contract

A 模块负责让 Owner 配置 AI 预审 Prompt 模板和评分维度。C 的 `PreReviewAgent` 只消费冻结后的 `RubricVersion` 与 `AgentPolicy`。

## Prompt Version Rules

- Prompt 模板必须有 `promptTemplateVersionId`。
- Prompt 变更后必须生成新版本，不覆盖历史版本。
- `AgentRun` 必须记录 Prompt 版本和评分维度。

## Required Dimensions

飞书验收要求第一版至少包含：

- 相关性
- 准确性
- 格式合规
- 安全性

## Structured Precheck Output

C 的预审输出必须保持结构化：

```json
{
  "decision": "pass | needs_review | reject",
  "confidence": 0.86,
  "ruleResults": [
    {
      "ruleId": "R1",
      "status": "pass | fail | uncertain",
      "evidence": "标注文本与原文实体边界一致",
      "suggestion": "无需修改"
    }
  ],
  "riskTags": ["missing_required_field"],
  "summary": "需要人工复核。"
}
```

## Owner Editable Fields

- `promptTemplate`: 预审 Agent 总指令。
- `dimensions`: 评分维度。
- `rules`: 结构化 Rubric 规则。
- `confidenceThreshold`: 置信度阈值。
- `toolWhitelist`: 允许调用的 MCP 工具。

# Skill: review-assist

## 描述
人工审核辅助输出规则 - 成员B的ReviewAssistAgent使用此Skill。

## 版本
1.0

## 核心规则
1. 检索最多5条相似历史标注案例
2. 相似案例按相似度从高到低排序展示
3. 存在ReviewConflict时生成冲突解释和3条解决建议
4. Agent只提供辅助信息，不直接决定审核通过或退回
5. 输出必须包含similarCases、riskTags字段

## 输入Schema
```json
{
  "type": "object",
  "properties": {
    "taskId": { "type": "string" },
    "itemId": { "type": "string" },
    "annotationResult": { "type": "object" }
  },
  "required": ["taskId", "itemId", "annotationResult"]
}
```

## 输出Schema
```json
{
  "type": "object",
  "properties": {
    "taskId": { "type": "string" },
    "itemId": { "type": "string" },
    "similarCases": { "type": "array" },
    "conflictExplanation": { "type": ["object", "null"] },
    "riskTags": { "type": "array" },
    "metadata": { "type": "object" }
  }
}
```

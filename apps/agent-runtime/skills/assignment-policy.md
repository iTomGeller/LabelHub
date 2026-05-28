# Skill: assignment-policy

## 描述
任务分发和人员负载建议规则 - 成员B的AssignmentAgent使用此Skill。

## 版本
1.0

## 核心规则
1. 优先分配给当前活跃任务数最少的标注员
2. 当标注员连续15分钟处于活跃但未完成状态时，触发SLA WARNING
3. 当超过30分钟时，触发SLA CRITICAL告警
4. 推荐配额 = max(3, 10 - 当前活跃数)
5. Agent只输出建议，不直接修改任务分配状态机

## 输入Schema
```json
{
  "type": "object",
  "properties": {
    "taskId": { "type": "string" }
  },
  "required": ["taskId"]
}
```

## 输出Schema
```json
{
  "type": "object",
  "properties": {
    "recommendedLabelerIds": { "type": "array", "items": { "type": "string" } },
    "slaAlerts": { "type": "array" },
    "metadata": { "type": "object" }
  }
}
```

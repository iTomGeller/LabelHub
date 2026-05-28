# Workflow State Machine - 成员 B 状态机完整规范

## 状态枚举全量定义

### Task 状态
- DRAFT: 任务创建中
- PUBLISHED: 任务已发布到任务广场
- PAUSED: 任务暂停
- COMPLETED: 任务全部完成

### DataItem 状态
- CREATED: 条目刚导入系统
- ASSIGNED: 已分配给标注员
- IN_PROGRESS: 标注进行中
- SUBMITTED: 标注正式提交
- AI_REVIEW_PENDING: AI 预审队列中
- AI_REVIEWED: AI 质检完成
- MANUAL_REVIEW_PENDING: 人工审核池中
- REVIEW_PASSED: 人工审核通过
- REVIEW_REJECTED: 人工审核驳回
- ARCHIVED: 最终归档

### Assignment 状态
- ACTIVE: 分配正在进行
- PAUSED: 分配暂停
- COMPLETED: 分配全部完成
- EXPIRED: 分配超时过期

### Annotation 状态
- DRAFT: 标注草稿
- SUBMITTED: 标注已提交

### Review 状态
- PENDING: 待审核
- PASSED: 审核通过
- REJECTED: 审核驳回
- MODIFIED_PASSED: 修改后通过
- ARBITRATED: 已仲裁

## 完整状态转移规则

| 实体类型 | 当前状态 | 允许转移到的目标状态 |
|---|---|---|
| DataItem | CREATED | ASSIGNED |
| DataItem | ASSIGNED | IN_PROGRESS |
| DataItem | IN_PROGRESS | SUBMITTED |
| DataItem | SUBMITTED | AI_REVIEW_PENDING |
| DataItem | AI_REVIEW_PENDING | AI_REVIEWED |
| DataItem | AI_REVIEWED | MANUAL_REVIEW_PENDING / REVIEW_PASSED |
| DataItem | MANUAL_REVIEW_PENDING | REVIEW_PASSED / REVIEW_REJECTED |
| DataItem | REVIEW_REJECTED | IN_PROGRESS |
| DataItem | REVIEW_PASSED | ARCHIVED |

## RBAC 权限隔离矩阵

| 角色 | 权限范围 |
|---|---|
| 负责人 (OWNER) | 管理任务、分配人员、配置规则 |
| 标注员 (LABELER) | 领取任务、保存草稿、提交标注、查看自己的贡献统计 |
| 初审员 (REVIEWER_LEVEL_1) | 审核分配给我的条目、通过/驳回、写审核意见 |
| 复审员 (REVIEWER_LEVEL_2) | 复审有冲突的条目、仲裁、批量审核 |
| 管理员 (ADMIN) | 全量权限、用户管理、系统配置 |

## 所有合法 WorkflowEvent (带 traceId)
1. task.published - 任务发布
2. assignment.claimed - 任务被领取
3. annotation.draft_saved - 草稿已自动保存
4. annotation.submitted - 标注正式提交
5. review.completed - 审核动作完成
6. review.rejected - 审核驳回
7. review.conflict_created - 审核冲突已产生
8. assignment.timeout_released - 超时自动释放锁定

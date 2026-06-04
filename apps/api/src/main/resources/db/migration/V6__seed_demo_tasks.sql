-- V6: 初始化 Demo 种子任务数据
-- 4个演示任务，前后端mock数据完全对齐，用于本地开发演示

-- 任务1: 情感分类标注 (已发布 / 45%完成)
INSERT IGNORE INTO task_config (task_id, name, description, status, total_items, completed_items, current_step, total_steps, created_at, updated_at)
VALUES (
  'task_text_cls_001',
  '情感分类标注',
  '对用户评论进行正面/负面情感标注',
  'publishing',
  100,
  45,
  4,
  4,
  '2026-05-20 10:00:00',
  '2026-05-21 14:32:00'
);

-- 任务2: 实体识别 (已发布 / 60%完成)
INSERT IGNORE INTO task_config (task_id, name, description, status, total_items, completed_items, current_step, total_steps, created_at, updated_at)
VALUES (
  'task_ner_002',
  '实体识别',
  '抽取文本中的人物、地点、组织机构实体',
  'publishing',
  200,
  120,
  4,
  4,
  '2026-05-19 09:00:00',
  '2026-05-20 09:15:00'
);

-- 任务3: 问答对质量评估 (草稿 / 0%完成)
INSERT IGNORE INTO task_config (task_id, name, description, status, total_items, completed_items, current_step, total_steps, created_at, updated_at)
VALUES (
  'task_qa_003',
  '问答对质量评估',
  '对用户生成的问答对进行质量审核',
  'draft',
  150,
  0,
  1,
  4,
  '2026-05-18 14:00:00',
  '2026-05-19 16:40:00'
);

-- 任务4: 图片语义分割 (已发布 / 100%完成)
INSERT IGNORE INTO task_config (task_id, name, description, status, total_items, completed_items, current_step, total_steps, created_at, updated_at)
VALUES (
  'task_seg_004',
  '图片语义分割',
  '对自动驾驶场景图片进行像素级分割标注',
  'publishing',
  50,
  50,
  4,
  4,
  '2026-05-17 11:00:00',
  '2026-05-18 11:20:00'
);

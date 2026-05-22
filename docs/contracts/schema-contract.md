# Annotation Schema Contract

LabelHub A 模块输出 `AnnotationSchema`，B 的 `AnnotationRenderer` 和 C 的预审校验必须只依赖该契约，不读取 A 页面内部状态。

## Version Rules

- `schemaVersionId` 全局唯一。
- `taskId + version` 单调递增。
- 发布后的 `frozen=true` 版本不可修改，只能生成新草稿版本。
- B 保存标注时必须记录 `schemaVersionId`，避免新版本破坏历史标注。

## Component Contract

每个组件必须包含：

- `id`: 同一 Schema 内唯一。
- `type`: 受控组件类型，不允许自由字符串。
- `label`: 给标注员展示的字段名。
- `dataPath`: JSONPath 风格路径，必须以 `$.` 开头。
- `required`: 是否必填。
- `props`: 组件私有配置。
- `validation`: 运行时校验规则。
- `visibleWhen`: 可选条件显示规则。
- `groupId` / `tabId`: 可选分组与多 Tab 布局。

## Required Component Types

- `shortText`: 单行输入。
- `longText`: 多行文本。
- `singleChoice`: 单选。
- `multiChoice`: 多选。
- `tagSelect`: 标签选择。
- `richText`: 富文本编辑器。
- `fileUpload`: 文件/图片上传。
- `jsonEditor`: JSON 编辑器。
- `llmInteraction`: LLM 辅助交互组件，必须记录输入、输出、traceId、是否采纳。
- `showItem`: 展示原始数据或说明，不写入标注结果。

## Validation Rules

第一版支持：

- `required`
- `minLength`
- `maxLength`
- `regex`
- `custom`

B 提交前必须执行字段级校验，并把错误定位到组件 `id`。

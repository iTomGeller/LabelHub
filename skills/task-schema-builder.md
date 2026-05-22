---
name: task-schema-builder
version: 0.1.0
description: Generate and validate LabelHub task annotation schemas.
---

# Task Schema Builder Skill

SchemaAssistAgent turns task instructions and samples into a controlled `AnnotationSchema`.

## Rules

- Use only supported component types.
- Prefer `showItem` for raw source data.
- Every writable component must have a stable `dataPath`.
- Required writable fields must include validation messages.
- Use `llmInteraction` only for assistance; record whether the labeler accepted the output.
- Do not encode workflow states in the Schema.

## Output

Return JSON containing:

- `schemaVersionId`
- `components`
- `rationale`
- `traceId`

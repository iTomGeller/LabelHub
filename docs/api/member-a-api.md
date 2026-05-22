# Member A API

Base path: `/api`

## Get TaskPackage

`GET /tasks/{taskId}/package`

Returns the frozen task package consumed by B/C.

## Get Current Schema

`GET /tasks/{taskId}/schema/current`

Returns the current `AnnotationSchema` so B can render annotation forms without coupling to A's page state.

## Get Instructions

`GET /tasks/{taskId}/instructions`

Returns the frozen instruction bundle, examples and Rubric summary for B/C.

## Get Next Data Item

`GET /tasks/{taskId}/items/next`

Returns a `DataItemView` with raw payload, display payload, media references and metadata.

## Publish Check

`POST /tasks/{taskId}/publish-check`

Runs A-side publish readiness checks:

- task title
- instruction version
- schema validity
- imported data
- rubric rules
- prompt template
- scoring dimensions
- AgentPolicy
- assignment policy

## Schema Risk

`POST /tasks/{taskId}/schema-risk`

Returns `SchemaRiskReport` for Owner review before publishing.

## Dataset Profile

`POST /tasks/{taskId}/dataset-profile`

Returns `DatasetProfileReport` from imported samples.

## Dataset Import Preview

`POST /datasets/{taskId}/import-preview`

Returns accepted formats, inferred field mappings and rejected row diagnostics before data is committed.

## Health

`GET /tasks/health`

Returns `labelhub-api-ok`.

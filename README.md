# LabelHub

LabelHub is an AI data annotation production platform. This branch starts member A's loop: task configuration, dynamic form schema building, dataset import, TaskPackage contracts and task-building agents.

## Current Scope

- `apps/web`: Next.js Owner console with AppShell, task wizard, SchemaBuilder, dataset import preview, AgentPanel and TaskPackage preview.
- `apps/api`: Spring Boot 3 API for TaskPackage, publish checks, schema risk and dataset profile endpoints.
- `apps/agent-runtime`: FastAPI runtime with LangGraph-ready SchemaAssist, RubricDraft and DatasetProfile agent endpoints.
- `packages/contracts`: Shared TypeScript contracts and mock TaskPackage used by B/C.
- `docs/contracts`: Schema, Rubric and Prompt template contracts.
- `deploy`: Dockerfiles, Compose and Aliyun ECS runbook prepared for later deployment.

## Development

```bash
npm install
npm run typecheck
```

Spring Boot:

```bash
mvn -f apps/api/pom.xml test
```

Agent runtime:

```bash
cd apps/agent-runtime
python -m venv .venv
pip install -e .
uvicorn labelhub_agent_runtime.main:app --reload
```

## Docker

Docker assets are prepared under each app and `deploy/docker-compose.yml`. Per current team direction, do not deploy locally with Docker; use these files later when ECS is available.

## Member A Acceptance

- Owner can configure a task and preview publish readiness.
- SchemaBuilder supports the required 10 controlled component types at contract level.
- TaskPackage is versioned and consumable by B/C without reading A page state.
- API exposes publish checks, schema risk and dataset profile data.
- A-side agents return structured JSON suggestions with `traceId`.
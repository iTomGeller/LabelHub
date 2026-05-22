from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="LabelHub Agent Runtime", version="0.1.0")


class AgentSuggestionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")
    instruction: str
    sample_rows: list[str] = Field(alias="sampleRows")
    trace_id: str = Field(alias="traceId")


class SchemaDraft(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version_id: str = Field(alias="schemaVersionId")
    components: list[dict]
    rationale: list[str]
    trace_id: str = Field(alias="traceId")


class RubricDraft(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rubric_version_id: str = Field(alias="rubricVersionId")
    dimensions: list[str]
    rules: list[dict]
    trace_id: str = Field(alias="traceId")


class DatasetProfileReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")
    sample_size: int = Field(alias="sampleSize")
    warnings: list[str]
    trace_id: str = Field(alias="traceId")


class InstructionRefineResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")
    refined_instruction: str = Field(alias="refinedInstruction")
    ambiguity_warnings: list[str] = Field(alias="ambiguityWarnings")
    trace_id: str = Field(alias="traceId")


class SchemaRiskResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")
    findings: list[dict]
    trace_id: str = Field(alias="traceId")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/agents/schema-assist", response_model=SchemaDraft)
def schema_assist(request: AgentSuggestionRequest) -> SchemaDraft:
    return SchemaDraft(
        schemaVersionId=f"schema_draft_{request.task_id}",
        components=[
            {
                "id": "raw_text",
                "type": "showItem",
                "label": "原始文本",
                "dataPath": "$.raw.text",
                "required": False,
            },
            {
                "id": "category",
                "type": "singleChoice",
                "label": "分类结果",
                "dataPath": "$.annotation.category",
                "required": True,
            },
            {
                "id": "tags",
                "type": "multiChoice",
                "label": "问题类型",
                "dataPath": "$.annotation.tags",
                "required": True,
            },
            {
                "id": "reason",
                "type": "longText",
                "label": "判断理由",
                "dataPath": "$.annotation.reason",
                "required": True,
            },
        ],
        rationale=[
            "根据任务说明抽取原始展示字段、分类字段和理由字段。",
            "输出仍需负责人在 SchemaBuilder 中确认后才能冻结版本。",
        ],
        traceId=request.trace_id,
    )


@app.post("/agents/rubric-draft", response_model=RubricDraft)
def rubric_draft(request: AgentSuggestionRequest) -> RubricDraft:
    return RubricDraft(
        rubricVersionId=f"rubric_draft_{request.task_id}",
        dimensions=["相关性", "准确性", "格式合规", "安全性"],
        rules=[
            {
                "ruleId": "R1",
                "severity": "high",
                "description": "标注结论必须能从原始样本中找到直接依据。",
                "appliesTo": ["category", "reason"],
                "allowAgentAutoPass": True,
            },
            {
                "ruleId": "R2",
                "severity": "medium",
                "description": "理由必须包含可追溯证据，不能只写结论。",
                "appliesTo": ["reason"],
                "allowAgentAutoPass": False,
            },
        ],
        traceId=request.trace_id,
    )


@app.post("/agents/dataset-profile", response_model=DatasetProfileReport)
def dataset_profile(request: AgentSuggestionRequest) -> DatasetProfileReport:
    warnings = []
    if len(request.sample_rows) < 20:
        warnings.append("样本少于 20 条，建议扩大抽样后再发布任务。")
    if any(not row.strip() for row in request.sample_rows):
        warnings.append("抽样中包含空行，导入时需要错误行提示。")
    return DatasetProfileReport(
        taskId=request.task_id,
        sampleSize=len(request.sample_rows),
        warnings=warnings,
        traceId=request.trace_id,
    )


@app.post("/agents/instruction-refine", response_model=InstructionRefineResult)
def instruction_refine(request: AgentSuggestionRequest) -> InstructionRefineResult:
    warnings = []
    if "依据" not in request.instruction:
        warnings.append("任务说明没有明确要求标注员引用原文依据。")
    if "退回" not in request.instruction:
        warnings.append("任务说明没有说明被打回后如何修改。")
    return InstructionRefineResult(
        taskId=request.task_id,
        refinedInstruction=(
            request.instruction.strip()
            + "\n\n标注员必须引用原文关键词作为依据；遇到多意图样本时选择最主要意图，并在问题类型中多选补充。"
        ),
        ambiguityWarnings=warnings,
        traceId=request.trace_id,
    )


@app.post("/agents/schema-risk", response_model=SchemaRiskResult)
def schema_risk(request: AgentSuggestionRequest) -> SchemaRiskResult:
    findings = []
    if len(request.sample_rows) < 20:
        findings.append(
            {
                "severity": "medium",
                "message": "样本少于 20 条，Schema 风险判断可能不稳定。",
                "recommendation": "导入更多样本后再冻结 Schema 版本。",
            }
        )
    if any("退款" in row for row in request.sample_rows) and "退款" not in request.instruction:
        findings.append(
            {
                "severity": "high",
                "message": "样本中出现退款语义，但任务说明未覆盖退款判定口径。",
                "recommendation": "在 Rubric 中增加售后/退款相关规则。",
            }
        )
    return SchemaRiskResult(taskId=request.task_id, findings=findings, traceId=request.trace_id)

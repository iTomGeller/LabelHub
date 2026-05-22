from __future__ import annotations

import json
import os
import traceback

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="LabelHub Agent Runtime", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

def get_client() -> OpenAI:
    return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


# ─── Request / Response Models ───

class GenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    task_id: str = Field(alias="taskId")
    task_name: str = Field(alias="taskName", default="")
    instruction: str = Field(default="")
    sample_data: list[dict] = Field(alias="sampleData", default_factory=list)
    trace_id: str = Field(alias="traceId", default="")


class GenerateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    task_id: str = Field(alias="taskId")
    schema_components: list[dict] = Field(alias="schemaComponents")
    rubric_rules: list[dict] = Field(alias="rubricRules")
    rubric_dimensions: list[str] = Field(alias="rubricDimensions")
    assignment_policy: dict = Field(alias="assignmentPolicy")
    agent_policy: dict = Field(alias="agentPolicy")
    rationale: str
    trace_id: str = Field(alias="traceId")


# ─── Endpoints ───

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "deepseek-chat", "api_key_set": bool(DEEPSEEK_API_KEY)}


@app.post("/agents/generate-task-config", response_model=GenerateResponse)
def generate_task_config(req: GenerateRequest) -> GenerateResponse:
    """One-shot: generate schema components + rubric rules + policies from task description and sample data."""
    sample_preview = json.dumps(req.sample_data[:3], ensure_ascii=False, indent=2) if req.sample_data else "无样例数据"

    system_prompt = """你是 LabelHub 的任务配置 AI 助手。你的职责是根据用户的任务描述和样例数据，生成完整的标注任务配置。

你必须返回一个合法 JSON 对象（不要用 markdown code block），包含以下字段：
- schemaComponents: 标注模板组件数组，每个组件包含 {id, type, label, dataPath, required, props, validation}
  - type 必须是以下之一: shortText, longText, singleChoice, multiChoice, tagSelect, richText, fileUpload, jsonEditor, llmInteraction, showItem
  - 尽量覆盖多种 type，至少包含 showItem（展示原始数据）、singleChoice/multiChoice（分类）、longText（理由）
- rubricRules: 质检规则数组，每条包含 {ruleId, description, severity, appliesTo, positiveExamples, negativeExamples, allowAgentAutoPass}
  - severity: low/medium/high/critical
- rubricDimensions: 评分维度数组，至少4个（如 ["相关性","准确性","格式合规","安全性"]）
- assignmentPolicy: {mode: "auto_claim", replicasPerItem: 1, deadlineHours: 24, quotaPerLabeler: 50}
- agentPolicy: {precheckEnabled: true, confidenceThreshold: 0.8, modelPreference: "deepseek-chat", promptTemplateVersionId: "auto_v1"}
- rationale: 一段中文说明，解释你为什么这样配置"""

    user_prompt = f"""任务名称：{req.task_name or "未命名任务"}

任务说明：{req.instruction or "根据样例数据推断标注需求"}

样例数据（前3条）：
{sample_preview}

请根据以上信息生成完整的标注任务配置。"""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        result = json.loads(content)
    except Exception as e:
        traceback.print_exc()
        result = _fallback_config(req)
        result["rationale"] = f"DeepSeek 调用失败 ({type(e).__name__}: {e})，使用本地兜底配置。"

    return GenerateResponse(
        taskId=req.task_id,
        schemaComponents=result.get("schemaComponents", []),
        rubricRules=result.get("rubricRules", []),
        rubricDimensions=result.get("rubricDimensions", ["相关性", "准确性", "格式合规", "安全性"]),
        assignmentPolicy=result.get("assignmentPolicy", {"mode": "auto_claim", "replicasPerItem": 1, "deadlineHours": 24, "quotaPerLabeler": 50}),
        agentPolicy=result.get("agentPolicy", {"precheckEnabled": True, "confidenceThreshold": 0.8, "modelPreference": "deepseek-chat", "promptTemplateVersionId": "auto_v1"}),
        rationale=result.get("rationale", "已生成配置"),
        traceId=req.trace_id or f"trace_{req.task_id}",
    )


def _fallback_config(req: GenerateRequest) -> dict:
    """Local fallback when DeepSeek is unreachable."""
    fields = []
    if req.sample_data:
        fields = list(req.sample_data[0].keys())

    components = [
        {"id": "raw_display", "type": "showItem", "label": "原始数据", "dataPath": "$.raw", "required": False, "props": {}, "validation": []},
        {"id": "category", "type": "singleChoice", "label": "分类标签", "dataPath": "$.annotation.category", "required": True,
         "props": {"options": ["类别A", "类别B", "类别C", "其他"]}, "validation": [{"type": "required", "value": True, "message": "请选择分类"}]},
        {"id": "reason", "type": "longText", "label": "判断理由", "dataPath": "$.annotation.reason", "required": True,
         "props": {"placeholder": "请说明判断依据"}, "validation": [{"type": "required", "value": True, "message": "请填写理由"}, {"type": "minLength", "value": 5, "message": "至少5个字"}]},
    ]

    rules = [
        {"ruleId": "R1", "description": "标注结论必须有原文依据", "severity": "high", "appliesTo": ["category", "reason"],
         "positiveExamples": ["引用了原文关键信息"], "negativeExamples": ["没有依据直接下结论"], "allowAgentAutoPass": True},
        {"ruleId": "R2", "description": "理由不能为空或过短", "severity": "medium", "appliesTo": ["reason"],
         "positiveExamples": ["详细说明了判断过程"], "negativeExamples": ["只写了一个字"], "allowAgentAutoPass": False},
    ]

    return {
        "schemaComponents": components,
        "rubricRules": rules,
        "rubricDimensions": ["相关性", "准确性", "格式合规", "安全性"],
        "assignmentPolicy": {"mode": "auto_claim", "replicasPerItem": 1, "deadlineHours": 24, "quotaPerLabeler": 50},
        "agentPolicy": {"precheckEnabled": True, "confidenceThreshold": 0.8, "modelPreference": "deepseek-chat", "promptTemplateVersionId": "auto_v1"},
        "rationale": "本地兜底配置：展示项 + 单选分类 + 理由文本",
    }

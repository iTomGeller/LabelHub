from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime


class ToolCallRecord(BaseModel):
    tool_name: str
    arguments_summary: str
    result_summary: str
    latency_ms: int
    error_code: Optional[str] = None


class LlmCallRecord(BaseModel):
    model_name: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    validation_passed: bool


class AgentRunRecord(BaseModel):
    id: str
    agent_name: str
    skill_name: str
    skill_version: str
    task_id: str
    item_id: Optional[str] = None
    trace_id: str
    status: str
    input_summary: str
    output_summary: str
    context_refs_json: str
    tool_calls_json: str
    llm_calls_json: str
    latency_ms: Optional[int] = None
    queue_wait_ms: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class AgentResultOutput(BaseModel):
    id: str
    agent_run_id: str
    task_id: str
    item_id: str
    result_type: str
    suggestion: str
    confidence: float
    evidence_json: str
    metadata_json: str
    status: str
    created_at: datetime

import httpx
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
import json

from .tracer import get_current_trace_id, generate_trace_id
from ..schemas.agent_run import ToolCallRecord, LlmCallRecord


class AgentRunRecorder:
    """Agent运行记录器 - 严格记录所有Agent执行过程用于可观测性"""
    
    def __init__(self, api_base_url: str = "http://localhost:8080/api/v1"):
        self.api_base_url = api_base_url
        self.tool_calls: List[ToolCallRecord] = []
        self.llm_calls: List[LlmCallRecord] = []
        self.start_time_ns: Optional[int] = None
        self.queue_wait_ms: Optional[int] = None
    
    def start(self):
        self.start_time_ns = datetime.now().timestamp() * 1_000_000_000
    
    def record_tool_call(self, tool_name: str, args_summary: str, result_summary: str, 
                         latency_ms: int, error_code: Optional[str] = None):
        """记录MCP工具调用"""
        record = ToolCallRecord(
            tool_name=tool_name,
            arguments_summary=args_summary,
            result_summary=result_summary,
            latency_ms=latency_ms,
            error_code=error_code
        )
        self.tool_calls.append(record)
    
    def record_llm_call(self, model_name: str, prompt_version: str, 
                        input_tokens: int, output_tokens: int, 
                        latency_ms: int, validation_passed: bool):
        """记录LLM调用"""
        record = LlmCallRecord(
            model_name=model_name,
            prompt_version=prompt_version,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            validation_passed=validation_passed
        )
        self.llm_calls.append(record)
    
    def set_queue_wait_ms(self, ms: int):
        """设置队列等待时间"""
        self.queue_wait_ms = ms
    
    def _calculate_latency_ms(self) -> int:
        if self.start_time_ns is None:
            return 0
        elapsed_ns = (datetime.now().timestamp() * 1_000_000_000) - self.start_time_ns
        return int(elapsed_ns / 1_000_000)
    
    async def finalize_and_submit(
        self,
        agent_name: str,
        skill_name: str,
        skill_version: str,
        task_id: str,
        item_id: Optional[str],
        input_summary: str,
        output_summary: str,
        context_refs: Dict[str, Any],
        status: str,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """完成记录并提交到Spring Boot后端"""
        trace_id = get_current_trace_id() or generate_trace_id()
        
        agent_run_id = str(uuid.uuid4())
        completed_at = datetime.now()
        
        agent_run_data = {
            "id": agent_run_id,
            "agentName": agent_name,
            "skillName": skill_name,
            "skillVersion": skill_version,
            "taskId": task_id,
            "itemId": item_id,
            "traceId": trace_id,
            "status": status,
            "inputSummary": input_summary,
            "outputSummary": output_summary,
            "contextRefsJson": json.dumps(context_refs, ensure_ascii=False),
            "toolCallsJson": json.dumps([tc.model_dump() for tc in self.tool_calls], ensure_ascii=False),
            "llmCallsJson": json.dumps([lc.model_dump() for lc in self.llm_calls], ensure_ascii=False),
            "latencyMs": self._calculate_latency_ms(),
            "queueWaitMs": self.queue_wait_ms,
            "errorCode": error_code,
            "errorMessage": error_message,
            "createdAt": datetime.now().isoformat(),
            "completedAt": completed_at.isoformat(),
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.api_base_url}/agent-runs",
                    json=agent_run_data
                )
                if resp.status_code == 200:
                    return agent_run_data
        except Exception:
            pass
        
        return agent_run_data

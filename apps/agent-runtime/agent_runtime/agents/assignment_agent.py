import time
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from .state import AssignmentAgentState
from ..mcp import McpBClient, get_mcp_client
from ..observability import AgentRunRecorder
from ..observability.tracer import get_current_trace_id, generate_trace_id, trace_context


async def fetch_assignment_suggestion_node(state: AssignmentAgentState) -> Dict[str, Any]:
    """调用MCP工具获取分配建议"""
    recorder = AgentRunRecorder()
    recorder.start()
    
    mcp_client: McpBClient = get_mcp_client()
    start_ns = time.time_ns()
    
    try:
        suggestion = await mcp_client.a_get_assignment_load(state["task_id"])
        latency_ms = int((time.time_ns() - start_ns) / 1_000_000)
        
        recorder.record_tool_call(
            tool_name="assignment.getLoad",
            args_summary=f"taskId={state['task_id']}",
            result_summary=f"recommendedLabelerIds={len(suggestion.recommended_labeler_ids)}, slaAlerts={len(suggestion.sla_alerts)}",
            latency_ms=latency_ms,
        )
        
        return {
            "assignment_suggestion": suggestion.model_dump(),
            "context_refs": {"source": "mcp.assignment.getLoad", "taskId": state["task_id"]},
            "tool_calls": [{"name": "assignment.getLoad", "latencyMs": latency_ms}]
        }
    except Exception as e:
        return {
            "assignment_suggestion": None,
            "context_refs": {"error": str(e)},
            "tool_calls": []
        }


async def finalize_assignment_node(state: AssignmentAgentState) -> Dict[str, Any]:
    """完成Agent运行记录"""
    recorder = AgentRunRecorder()
    trace_id = get_current_trace_id() or state.get("trace_id", generate_trace_id())
    
    await recorder.finalize_and_submit(
        agent_name="AssignmentAgent",
        skill_name=state["skill_name"],
        skill_version=state["skill_version"],
        task_id=state["task_id"],
        item_id=None,
        input_summary=f"taskId={state['task_id']}",
        output_summary=f"suggestion={state.get('assignment_suggestion') is not None}",
        context_refs=state.get("context_refs", {}),
        status="COMPLETED" if state.get("assignment_suggestion") else "FAILED",
    )
    
    return {}


def build_assignment_agent_graph():
    """构建Assignment Agent的LangGraph DAG"""
    workflow = StateGraph(AssignmentAgentState)
    
    workflow.add_node("fetch_suggestion", fetch_assignment_suggestion_node)
    workflow.add_node("finalize", finalize_assignment_node)
    
    workflow.set_entry_point("fetch_suggestion")
    workflow.add_edge("fetch_suggestion", "finalize")
    workflow.add_edge("finalize", END)
    
    return workflow.compile()


class AssignmentAgent:
    """AssignmentAgent - 任务分发和人员负载建议Agent
    
    成员B Agent边界：
    - 只建议分配策略、提示SLA风险
    - 不直接决定最终分配
    - 输出进入调度建议
    """
    
    def __init__(self):
        self.graph = build_assignment_agent_graph()
    
    async def execute(self, task_id: str, skill_version: str = "1.0") -> Dict[str, Any]:
        trace_id = generate_trace_id()
        
        with trace_context(trace_id):
            initial_state: AssignmentAgentState = {
                "task_id": task_id,
                "trace_id": trace_id,
                "skill_name": "assignment-policy",
                "skill_version": skill_version,
                "assignment_suggestion": None,
                "context_refs": {},
                "tool_calls": []
            }
            
            result = await self.graph.ainvoke(initial_state)
            return {
                "traceId": trace_id,
                "assignmentSuggestion": result.get("assignment_suggestion")
            }
